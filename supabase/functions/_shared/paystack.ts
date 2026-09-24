// Real Paystack integration for Deno Edge Functions. Throws if
// PAYSTACK_SECRET_KEY isn't set as a Supabase function secret.
import { HttpError } from "./supabaseAdmin.ts";

function secretKey(): string {
  const key = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!key) {
    throw new HttpError(
      503,
      "Paystack is not configured yet. Add PAYSTACK_SECRET_KEY as a Supabase function secret."
    );
  }
  return key;
}

export function isPaystackConfigured(): boolean {
  return Boolean(Deno.env.get("PAYSTACK_SECRET_KEY"));
}

export async function initializeTransaction(params: {
  email: string;
  amountNaira: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}): Promise<{ authorizationUrl: string; accessCode: string }> {
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: params.email,
      amount: Math.round(params.amountNaira * 100),
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    }),
  });
  if (!res.ok) throw new HttpError(502, `Paystack error: HTTP ${res.status} initializing payment`);

  const data = await res.json();
  if (!data.status || !data.data) {
    throw new HttpError(502, `Paystack error: ${data.message ?? "Could not start payment."}`);
  }
  return { authorizationUrl: data.data.authorization_url, accessCode: data.data.access_code };
}

export async function verifyTransaction(reference: string): Promise<{ success: boolean; amount: number }> {
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
  });
  if (!res.ok) throw new HttpError(502, `Paystack error: HTTP ${res.status} verifying payment`);

  const data = await res.json();
  const ok = data.status && data.data?.status === "success";
  return { success: Boolean(ok), amount: (data.data?.amount ?? 0) / 100 };
}
