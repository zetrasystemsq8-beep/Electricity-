// POST { meterId, amount } - creates the Purchase + pending Transaction, and
// (if Paystack is configured) a real hosted checkout session for it via
// Paystack's transaction/initialize endpoint. Mirrors the original Express
// purchaseService.initiatePurchase + the purchase.routes.ts Paystack call.
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin, requireUser, HttpError } from "../_shared/supabaseAdmin.ts";
import { isPaystackConfigured, initializeTransaction } from "../_shared/paystack.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { userId } = await requireUser(req);
    const { meterId, amount } = await req.json();
    if (!meterId || !amount || amount <= 0) throw new HttpError(400, "meterId and a positive amount are required.");

    const admin = supabaseAdmin();

    const { data: meter, error: meterErr } = await admin
      .from("meters")
      .select("*, disco:discos(*)")
      .eq("id", meterId)
      .eq("user_id", userId)
      .single();
    if (meterErr || !meter) throw new HttpError(404, "Meter not found.");
    if (meter.verification_status !== "VERIFIED") {
      throw new HttpError(400, "Please verify this meter before buying electricity.");
    }
    if (meter.minimum_purchase && amount < meter.minimum_purchase) {
      throw new HttpError(400, `The minimum purchase for this meter is ₦${meter.minimum_purchase}.`);
    }

    const { data: profile } = await admin.from("profiles").select("phone_number").eq("id", userId).single();

    const { data: purchase, error: purchaseErr } = await admin
      .from("purchases")
      .insert({ user_id: userId, meter_id: meterId, amount_requested: amount })
      .select()
      .single();
    if (purchaseErr) throw new HttpError(500, purchaseErr.message);

    const internalRef = `PUR-${purchase.id}-${crypto.randomUUID().slice(0, 8)}`;

    const { data: transaction, error: txnErr } = await admin
      .from("transactions")
      .insert({ purchase_id: purchase.id, internal_ref: internalRef, provider_name: "VTpass", status: "PENDING" })
      .select()
      .single();
    if (txnErr) throw new HttpError(500, txnErr.message);

    await admin.from("transaction_events").insert({ transaction_id: transaction.id, to_status: "PENDING", note: "Transaction created" });

    const responseBody: Record<string, unknown> = {
      purchaseId: purchase.id,
      transactionId: transaction.id,
      internalRef,
      amount,
      meter: { id: meter.id, label: meter.label, meterNumber: meter.meter_number, disco: meter.disco.name },
    };

    if (!isPaystackConfigured()) {
      responseBody.paymentConfigured = false;
      responseBody.paystackPublicNote =
        "Payment collection isn't configured yet - add PAYSTACK_SECRET_KEY as a Supabase function secret to accept real payments.";
    } else {
      const checkout = await initializeTransaction({
        email: `${profile?.phone_number ?? userId}@powerpal.ng`,
        amountNaira: amount,
        reference: internalRef,
        callbackUrl: "https://powerpal.app/payment-callback",
        metadata: { transactionId: transaction.id, userId },
      });
      responseBody.paymentConfigured = true;
      responseBody.checkoutUrl = checkout.authorizationUrl;
    }

    return new Response(JSON.stringify(responseBody), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return new Response(JSON.stringify({ error: { message } }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
