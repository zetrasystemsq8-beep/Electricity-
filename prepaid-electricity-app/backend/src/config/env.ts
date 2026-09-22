// Central place that reads and validates environment variables.
// Nothing else in the codebase should call process.env directly -
// that way a missing/blank credential fails in one obvious place
// instead of silently producing undefined deep inside a provider.

import dotenv from "dotenv";
dotenv.config();

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v : undefined;
}

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL", "file:./dev.db"),
  jwtSecret: required("JWT_SECRET", "dev-only-insecure-secret-change-me"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",

  activeElectricityProvider: process.env.ACTIVE_ELECTRICITY_PROVIDER ?? "vtpass",

  vtpass: {
    baseUrl: process.env.VTPASS_BASE_URL ?? "https://sandbox.vtpass.com/api",
    apiKey: optional("VTPASS_API_KEY"),
    publicKey: optional("VTPASS_PUBLIC_KEY"),
    secretKey: optional("VTPASS_SECRET_KEY"),
    email: optional("VTPASS_EMAIL"),
  },

  paystack: {
    secretKey: optional("PAYSTACK_SECRET_KEY"),
    webhookSecret: optional("PAYSTACK_WEBHOOK_SECRET"),
  },
};

export function isVtpassConfigured(): boolean {
  return Boolean(env.vtpass.apiKey && env.vtpass.secretKey);
}

export function isPaystackConfigured(): boolean {
  return Boolean(env.paystack.secretKey);
}
