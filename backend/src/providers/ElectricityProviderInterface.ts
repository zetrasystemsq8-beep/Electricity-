// Section 25/24: every electricity vending / meter-data source in this app
// must implement this interface. The rest of the codebase (services, routes)
// only ever talks to ElectricityProviderInterface, never to a concrete
// provider class - that's what lets us add Paybeta, Powershop, a direct
// DISCO integration, or a real-time AMI feed later without touching
// purchaseService/meterService.

export interface MeterVerificationResult {
  meterNumber: string;
  discoShortCode: string;
  customerName: string;
  address?: string;
  meterType?: "SINGLE_PHASE" | "THREE_PHASE" | "UNKNOWN";
  minimumPurchase?: number;
  raw: unknown; // untouched provider payload, kept for support/debugging
}

export interface VendElectricityRequest {
  meterNumber: string;
  discoShortCode: string;
  amount: number;
  phoneNumber?: string;
  internalRef: string; // our idempotency key, must be passed through to the provider
}

export interface VendElectricityResult {
  providerTransactionId: string;
  status: "SUCCESSFUL" | "PENDING" | "FAILED";
  token?: string;
  unitsKwh?: number;
  /** Exactly what the provider says was the electricity value component. Never invented. */
  electricityCreditRaw?: number;
  /** Exactly what the provider says was fees/charges. Never invented. */
  otherChargesRaw?: number;
  raw: unknown;
}

export interface RequeryResult {
  providerTransactionId: string;
  status: "SUCCESSFUL" | "PENDING" | "FAILED";
  token?: string;
  unitsKwh?: number;
  raw: unknown;
}

/**
 * Real-time meter data source, distinct from vending. Most providers do NOT
 * implement this - it's the abstraction Phase 3 (section 24/27) plugs into
 * once an authorized AMI / DISCO data feed exists. A provider that can't
 * do this should simply not implement LiveMeterDataProvider; the estimation
 * engine is the fallback for everyone else.
 */
export interface LiveMeterDataProvider {
  getLiveBalance(meterNumber: string, discoShortCode: string): Promise<{
    balanceKwh: number;
    asOf: Date;
    raw: unknown;
  }>;
}

export interface ElectricityProviderInterface {
  readonly name: string;
  isConfigured(): boolean;
  verifyMeter(meterNumber: string, discoShortCode: string): Promise<MeterVerificationResult>;
  vendElectricity(request: VendElectricityRequest): Promise<VendElectricityResult>;
  requeryTransaction(internalRef: string): Promise<RequeryResult>;
}
