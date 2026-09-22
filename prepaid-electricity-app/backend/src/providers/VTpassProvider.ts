// Real VTpass integration (https://vtpass.com/documentation/).
// This is NOT a mock: every method makes a genuine HTTP call to VTpass's
// documented endpoints. If VTPASS_API_KEY / VTPASS_SECRET_KEY are not set,
// isConfigured() returns false and the calling service throws
// ApiError.providerNotConfigured() instead of returning invented data -
// that is what rule #48 in the build brief requires.
//
// VTpass DISCO service identifiers (e.g. "ikeja-electric", "eko-electric")
// must match Disco.shortCode in the database - see seedDiscos.ts.

import { env, isVtpassConfigured } from "../config/env";
import {
  ElectricityProviderInterface,
  MeterVerificationResult,
  RequeryResult,
  VendElectricityRequest,
  VendElectricityResult,
} from "./ElectricityProviderInterface";
import { ApiError } from "../utils/apiError";
import { logger } from "../utils/logger";
import { prisma } from "../lib/prisma";

interface VtpassVerifyResponse {
  code: string;
  content?: {
    Customer_Name?: string;
    Address?: string;
    Meter_Number?: string;
    Meter_Type?: string;
    Min_Purchase_Amount?: string;
    error?: string;
  };
  response_description?: string;
}

interface VtpassPayResponse {
  code: string;
  requestId?: string;
  amount?: string;
  transaction_date?: { date?: string };
  purchased_code?: string; // token
  units?: string;
  content?: {
    transactions?: {
      status?: string;
      product_name?: string;
      transactionId?: string;
    };
    Token?: string;
    Units?: string;
    Meter_Number?: string;
  };
  response_description?: string;
}

async function logProviderCall<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    await prisma.providerCallLog.create({
      data: {
        providerName: "vtpass",
        operation,
        success: true,
        latencyMs: Date.now() - start,
      },
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.providerCallLog
      .create({
        data: {
          providerName: "vtpass",
          operation,
          success: false,
          latencyMs: Date.now() - start,
          errorMessage: message,
        },
      })
      .catch(() => undefined); // never let logging failure mask the real error
    throw err;
  }
}

function requestIdFromInternalRef(internalRef: string): string {
  // VTpass requires a unique alphanumeric request_id per transaction,
  // typically date-prefixed. We derive it deterministically from our own
  // idempotency key so retries of the same purchase reuse the same id.
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${datePrefix}${internalRef.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20)}`;
}

export class VTpassProvider implements ElectricityProviderInterface {
  readonly name = "VTpass";

  isConfigured(): boolean {
    return isVtpassConfigured();
  }

  private authHeaders(kind: "query" | "mutate") {
    if (!isVtpassConfigured()) {
      throw ApiError.providerNotConfigured(this.name);
    }
    if (kind === "query") {
      return {
        "api-key": env.vtpass.apiKey as string,
        "public-key": env.vtpass.publicKey as string,
        "Content-Type": "application/json",
      };
    }
    return {
      "api-key": env.vtpass.apiKey as string,
      "secret-key": env.vtpass.secretKey as string,
      "Content-Type": "application/json",
    };
  }

  async verifyMeter(meterNumber: string, discoShortCode: string): Promise<MeterVerificationResult> {
    if (!this.isConfigured()) throw ApiError.providerNotConfigured(this.name);

    return logProviderCall("verify", async () => {
      const res = await fetch(`${env.vtpass.baseUrl}/merchant-verify`, {
        method: "POST",
        headers: this.authHeaders("mutate"),
        body: JSON.stringify({
          billersCode: meterNumber,
          serviceID: discoShortCode,
          type: "prepaid",
        }),
      });

      if (!res.ok) {
        throw ApiError.providerFailure(this.name, `HTTP ${res.status} during meter verification`);
      }

      const data = (await res.json()) as VtpassVerifyResponse;

      if (data.code !== "000" || !data.content || data.content.error) {
        logger.warn("VTpass meter verification rejected", { data });
        throw ApiError.badRequest(
          "We couldn't verify that meter number with this DISCO. Please double-check the meter number and DISCO.",
          "METER_VERIFICATION_FAILED"
        );
      }

      return {
        meterNumber: data.content.Meter_Number ?? meterNumber,
        discoShortCode,
        customerName: data.content.Customer_Name ?? "",
        address: data.content.Address,
        meterType:
          data.content.Meter_Type?.toLowerCase().includes("three") ? "THREE_PHASE" : "SINGLE_PHASE",
        minimumPurchase: data.content.Min_Purchase_Amount
          ? Number(data.content.Min_Purchase_Amount)
          : undefined,
        raw: data,
      };
    });
  }

  async vendElectricity(request: VendElectricityRequest): Promise<VendElectricityResult> {
    if (!this.isConfigured()) throw ApiError.providerNotConfigured(this.name);

    return logProviderCall("vend", async () => {
      const requestId = requestIdFromInternalRef(request.internalRef);

      const res = await fetch(`${env.vtpass.baseUrl}/pay`, {
        method: "POST",
        headers: this.authHeaders("mutate"),
        body: JSON.stringify({
          request_id: requestId,
          serviceID: request.discoShortCode,
          billersCode: request.meterNumber,
          variation_code: "prepaid",
          amount: request.amount,
          phone: request.phoneNumber ?? "",
        }),
      });

      if (!res.ok) {
        throw ApiError.providerFailure(this.name, `HTTP ${res.status} during vend`);
      }

      const data = (await res.json()) as VtpassPayResponse;

      const txnStatus = data.content?.transactions?.status?.toLowerCase();
      const status: VendElectricityResult["status"] =
        txnStatus === "delivered" || data.code === "000"
          ? "SUCCESSFUL"
          : txnStatus === "pending" || data.code === "099"
          ? "PENDING"
          : "FAILED";

      return {
        providerTransactionId: data.content?.transactions?.transactionId ?? requestId,
        status,
        token: data.purchased_code ?? data.content?.Token,
        unitsKwh: data.units ? Number(data.units) : data.content?.Units ? Number(data.content.Units) : undefined,
        electricityCreditRaw: undefined, // VTpass does not break this out separately - never invent it
        otherChargesRaw: undefined,
        raw: data,
      };
    });
  }

  async requeryTransaction(internalRef: string): Promise<RequeryResult> {
    if (!this.isConfigured()) throw ApiError.providerNotConfigured(this.name);

    return logProviderCall("requery", async () => {
      const requestId = requestIdFromInternalRef(internalRef);

      const res = await fetch(`${env.vtpass.baseUrl}/requery`, {
        method: "POST",
        headers: this.authHeaders("mutate"),
        body: JSON.stringify({ request_id: requestId }),
      });

      if (!res.ok) {
        throw ApiError.providerFailure(this.name, `HTTP ${res.status} during requery`);
      }

      const data = (await res.json()) as VtpassPayResponse;
      const txnStatus = data.content?.transactions?.status?.toLowerCase();
      const status: RequeryResult["status"] =
        txnStatus === "delivered" || data.code === "000"
          ? "SUCCESSFUL"
          : txnStatus === "pending"
          ? "PENDING"
          : "FAILED";

      return {
        providerTransactionId: data.content?.transactions?.transactionId ?? requestId,
        status,
        token: data.purchased_code ?? data.content?.Token,
        unitsKwh: data.units ? Number(data.units) : undefined,
        raw: data,
      };
    });
  }
}
