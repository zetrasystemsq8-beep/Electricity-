// Real VTpass integration (https://vtpass.com/documentation/) for Deno Edge
// Functions. Same behavior as the original Express provider: every call is
// a genuine HTTP request, and if VTPASS_API_KEY/VTPASS_SECRET_KEY aren't set
// as Supabase function secrets, these throw instead of returning fake data.
import { HttpError } from "./supabaseAdmin.ts";

function env(name: string): string | undefined {
  const v = Deno.env.get(name);
  return v && v.trim().length > 0 ? v : undefined;
}

function baseUrl(): string {
  return env("VTPASS_BASE_URL") ?? "https://sandbox.vtpass.com/api";
}

export function isVtpassConfigured(): boolean {
  return Boolean(env("VTPASS_API_KEY") && env("VTPASS_SECRET_KEY"));
}

function authHeaders(): Record<string, string> {
  if (!isVtpassConfigured()) {
    throw new HttpError(
      503,
      "VTpass is not configured yet. Add real VTPASS_API_KEY / VTPASS_SECRET_KEY as Supabase function secrets - we never fake a provider response."
    );
  }
  return {
    "api-key": env("VTPASS_API_KEY")!,
    "secret-key": env("VTPASS_SECRET_KEY")!,
    "Content-Type": "application/json",
  };
}

export interface MeterVerificationResult {
  customerName: string;
  address?: string;
  meterType: "SINGLE_PHASE" | "THREE_PHASE" | "UNKNOWN";
  minimumPurchase?: number;
  raw: unknown;
}

export async function verifyMeter(meterNumber: string, discoShortCode: string): Promise<MeterVerificationResult> {
  const res = await fetch(`${baseUrl()}/merchant-verify`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ billersCode: meterNumber, serviceID: discoShortCode, type: "prepaid" }),
  });
  if (!res.ok) throw new HttpError(502, `VTpass error: HTTP ${res.status} during meter verification`);

  const data = await res.json();
  if (data.code !== "000" || !data.content || data.content.error) {
    throw new HttpError(
      400,
      "We couldn't verify that meter number with this DISCO. Please double-check the meter number and DISCO."
    );
  }

  return {
    customerName: data.content.Customer_Name ?? "",
    address: data.content.Address,
    meterType: data.content.Meter_Type?.toLowerCase().includes("three") ? "THREE_PHASE" : "SINGLE_PHASE",
    minimumPurchase: data.content.Min_Purchase_Amount ? Number(data.content.Min_Purchase_Amount) : undefined,
    raw: data,
  };
}

export interface VendResult {
  providerTransactionId: string;
  status: "SUCCESSFUL" | "PENDING" | "FAILED";
  token?: string;
  unitsKwh?: number;
  electricityCreditRaw?: number;
  otherChargesRaw?: number;
  raw: unknown;
}

function requestIdFromInternalRef(internalRef: string): string {
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${datePrefix}${internalRef.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20)}`;
}

export async function vendElectricity(params: {
  meterNumber: string;
  discoShortCode: string;
  amount: number;
  phoneNumber?: string;
  internalRef: string;
}): Promise<VendResult> {
  const requestId = requestIdFromInternalRef(params.internalRef);

  const res = await fetch(`${baseUrl()}/pay`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      request_id: requestId,
      serviceID: params.discoShortCode,
      billersCode: params.meterNumber,
      variation_code: "prepaid",
      amount: params.amount,
      phone: params.phoneNumber ?? "",
    }),
  });
  if (!res.ok) throw new HttpError(502, `VTpass error: HTTP ${res.status} during vend`);

  const data = await res.json();
  const txnStatus = data.content?.transactions?.status?.toLowerCase();
  const status: VendResult["status"] =
    txnStatus === "delivered" || data.code === "000" ? "SUCCESSFUL" : txnStatus === "pending" || data.code === "099" ? "PENDING" : "FAILED";

  return {
    providerTransactionId: data.content?.transactions?.transactionId ?? requestId,
    status,
    token: data.purchased_code ?? data.content?.Token,
    unitsKwh: data.units ? Number(data.units) : data.content?.Units ? Number(data.content.Units) : undefined,
    raw: data,
  };
}
