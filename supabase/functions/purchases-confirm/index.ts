// POST { transactionId, processorRef } - re-verifies payment with Paystack
// server-side (never trusts the client's word that payment succeeded), then
// calls VTpass to vend electricity, and records everything: transaction
// status transitions (append-only, mirrors the original transactionService),
// the token, a new balance snapshot, and notifications. Idempotent on
// transactionId - safe to call twice.
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin, requireUser, HttpError } from "../_shared/supabaseAdmin.ts";
import { verifyTransaction } from "../_shared/paystack.ts";
import { vendElectricity } from "../_shared/vtpass.ts";

async function transition(
  admin: ReturnType<typeof supabaseAdmin>,
  transactionId: string,
  fromStatus: string | null,
  toStatus: string,
  fields: Record<string, unknown> = {},
  note?: string
) {
  await admin.from("transactions").update({ status: toStatus, ...fields }).eq("id", transactionId);
  await admin.from("transaction_events").insert({ transaction_id: transactionId, from_status: fromStatus, to_status: toStatus, note });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { userId } = await requireUser(req);
    const { transactionId, processorRef } = await req.json();
    if (!transactionId || !processorRef) throw new HttpError(400, "transactionId and processorRef are required.");

    const admin = supabaseAdmin();

    const { data: txn, error: txnErr } = await admin
      .from("transactions")
      .select("*, purchase:purchases(*, meter:meters(*, disco:discos(*)))")
      .eq("id", transactionId)
      .single();
    if (txnErr || !txn) throw new HttpError(404, "Transaction not found.");
    if (txn.purchase.user_id !== userId) throw new HttpError(404, "Transaction not found.");

    if (txn.status === "SUCCESSFUL") {
      return new Response(JSON.stringify(txn), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (txn.status !== "PENDING" && txn.status !== "PROCESSING") {
      throw new HttpError(409, `This transaction is already ${txn.status.toLowerCase()}.`);
    }

    const verified = await verifyTransaction(processorRef);
    if (!verified.success) throw new HttpError(400, "Payment could not be verified. Please try again.");

    const { data: existingPayment } = await admin.from("payments").select("id").eq("transaction_id", transactionId).maybeSingle();
    if (!existingPayment) {
      await admin.from("payments").insert({
        transaction_id: transactionId,
        processor: "paystack",
        processor_ref: processorRef,
        amount: verified.amount,
        status: "SUCCESSFUL",
        webhook_verified: true,
      });
    }

    await transition(admin, transactionId, txn.status, "PROCESSING", { amount_paid: verified.amount }, "Payment confirmed, calling vending provider");

    const meter = txn.purchase.meter;

    try {
      const result = await vendElectricity({
        meterNumber: meter.meter_number,
        discoShortCode: meter.disco.short_code,
        amount: txn.purchase.amount_requested,
        phoneNumber: meter.phone_number ?? undefined,
        internalRef: txn.internal_ref,
      });

      if (result.status === "FAILED") {
        await transition(admin, transactionId, "PROCESSING", "FAILED", { provider_transaction_id: result.providerTransactionId, failure_reason: "Provider declined the vend request." });
        throw new HttpError(502, "Vending failed. If you were charged, this will be refunded.");
      }

      if (result.status === "PENDING") {
        await transition(admin, transactionId, "PROCESSING", "PENDING", { provider_transaction_id: result.providerTransactionId }, "Provider is still processing - will be requeried.");
        const { data: pending } = await admin.from("transactions").select("*").eq("id", transactionId).single();
        return new Response(JSON.stringify(pending), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // SUCCESSFUL
      await transition(
        admin,
        transactionId,
        "PROCESSING",
        "SUCCESSFUL",
        {
          provider_transaction_id: result.providerTransactionId,
          units_kwh: result.unitsKwh,
          electricity_credit_raw: result.electricityCreditRaw,
          other_charges_raw: result.otherChargesRaw,
        },
        "Provider confirmed delivery"
      );

      if (result.token) {
        await admin.from("tokens").insert({
          purchase_id: txn.purchase_id,
          meter_id: meter.id,
          token_value: result.token,
          units: result.unitsKwh,
          amount: txn.purchase.amount_requested,
          loading_status: "NOT_LOADED",
        });
      }

      if (result.unitsKwh) {
        const { data: latestSnapshot } = await admin
          .from("balance_snapshots")
          .select("balance_kwh")
          .eq("meter_id", meter.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const newBalance = (latestSnapshot?.balance_kwh ?? 0) + result.unitsKwh;
        await admin.from("balance_snapshots").insert({
          meter_id: meter.id,
          balance_kwh: newBalance,
          source: "ESTIMATED",
          note: "Calculated after a purchase: previous estimated balance + units purchased.",
        });
      }

      await admin.from("notifications").insert([
        {
          user_id: userId,
          category: "TRANSACTION",
          title: "Purchase successful",
          body: `Your ₦${txn.purchase.amount_requested} purchase for ${meter.label} was successful.`,
        },
        ...(result.token
          ? [{ user_id: userId, category: "TOKEN", title: "Your token is ready", body: `Token for ${meter.label}: ${result.token}` }]
          : []),
      ]);

      const { data: finalTxn } = await admin.from("transactions").select("*").eq("id", transactionId).single();
      return new Response(JSON.stringify(finalTxn), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (err) {
      if (!(err instanceof HttpError)) {
        await transition(admin, transactionId, "PROCESSING", "FAILED", { failure_reason: "Unexpected error during vending." });
      }
      throw err;
    }
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return new Response(JSON.stringify({ error: { message } }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
