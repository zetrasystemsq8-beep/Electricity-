// Paystack webhook - the async fallback path if the app closes before the
// client calls purchases-confirm. Verifies the signature, then does the
// same vend flow as purchases-confirm. Public endpoint (no user JWT - the
// signature check IS the auth).
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { vendElectricity } from "../_shared/vtpass.ts";

async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const webhookSecret = Deno.env.get("PAYSTACK_WEBHOOK_SECRET");
  if (!webhookSecret) {
    return new Response(JSON.stringify({ error: "Webhook not configured" }), { status: 503, headers: corsHeaders });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");
  const expected = await hmacSha512Hex(webhookSecret, rawBody);

  if (signature !== expected) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: corsHeaders });
  }

  const event = JSON.parse(rawBody);
  const admin = supabaseAdmin();

  if (event.event === "charge.success" && event.data?.reference) {
    const metaTxnId = event.data.metadata?.transactionId;
    if (metaTxnId) {
      const { data: txn } = await admin
        .from("transactions")
        .select("*, purchase:purchases(*, meter:meters(*, disco:discos(*)))")
        .eq("id", metaTxnId)
        .single();

      if (txn && txn.status !== "SUCCESSFUL") {
        try {
          await admin.from("payments").upsert(
            {
              transaction_id: txn.id,
              processor: "paystack",
              processor_ref: event.data.reference,
              amount: (event.data.amount ?? 0) / 100,
              status: "SUCCESSFUL",
              webhook_verified: true,
            },
            { onConflict: "processor_ref" }
          );

          await admin.from("transactions").update({ status: "PROCESSING", amount_paid: (event.data.amount ?? 0) / 100 }).eq("id", txn.id);
          await admin.from("transaction_events").insert({ transaction_id: txn.id, from_status: txn.status, to_status: "PROCESSING", note: "Webhook: payment confirmed" });

          const meter = txn.purchase.meter;
          const result = await vendElectricity({
            meterNumber: meter.meter_number,
            discoShortCode: meter.disco.short_code,
            amount: txn.purchase.amount_requested,
            phoneNumber: meter.phone_number ?? undefined,
            internalRef: txn.internal_ref,
          });

          if (result.status === "SUCCESSFUL") {
            await admin
              .from("transactions")
              .update({ status: "SUCCESSFUL", provider_transaction_id: result.providerTransactionId, units_kwh: result.unitsKwh })
              .eq("id", txn.id);
            await admin.from("transaction_events").insert({ transaction_id: txn.id, from_status: "PROCESSING", to_status: "SUCCESSFUL", note: "Webhook: provider confirmed delivery" });

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

            await admin.from("notifications").insert({
              user_id: txn.purchase.user_id,
              category: "TRANSACTION",
              title: "Purchase successful",
              body: `Your ₦${txn.purchase.amount_requested} purchase for ${meter.label} was successful.`,
            });
          }
        } catch (err) {
          console.error("Webhook-triggered vend failed", err);
        }
      }
    }
  }

  // Always 200 quickly so Paystack doesn't retry unnecessarily.
  return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
