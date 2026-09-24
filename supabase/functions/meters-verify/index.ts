// POST { meterId } - verifies a meter the user already added (as UNVERIFIED)
// against VTpass, and updates the row with what the provider returns.
// Runs with the service-role key so it can write verificationRaw etc,
// but only after confirming the meter belongs to the calling user.
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin, requireUser, HttpError } from "../_shared/supabaseAdmin.ts";
import { verifyMeter } from "../_shared/vtpass.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { userId } = await requireUser(req);
    const { meterId } = await req.json();
    if (!meterId) throw new HttpError(400, "meterId is required.");

    const admin = supabaseAdmin();

    const { data: meter, error: meterErr } = await admin
      .from("meters")
      .select("id, meter_number, user_id, disco:discos(short_code)")
      .eq("id", meterId)
      .eq("user_id", userId)
      .single();

    if (meterErr || !meter) throw new HttpError(404, "Meter not found.");

    try {
      const result = await verifyMeter(meter.meter_number, (meter.disco as { short_code: string }).short_code);

      const { data: updated, error: updateErr } = await admin
        .from("meters")
        .update({
          customer_name: result.customerName,
          address: result.address,
          meter_type: result.meterType,
          minimum_purchase: result.minimumPurchase,
          verification_status: "VERIFIED",
          verified_at: new Date().toISOString(),
          verification_raw: result.raw,
        })
        .eq("id", meterId)
        .select("*, disco:discos(*)")
        .single();

      if (updateErr) throw new HttpError(500, updateErr.message);

      return new Response(JSON.stringify(updated), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      await admin.from("meters").update({ verification_status: "FAILED" }).eq("id", meterId);
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
