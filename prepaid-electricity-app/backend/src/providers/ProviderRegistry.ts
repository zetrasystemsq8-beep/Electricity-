// Section 25: "Do NOT hard-code the entire business around one provider."
// Add a new provider by implementing ElectricityProviderInterface and
// registering it here. ACTIVE_ELECTRICITY_PROVIDER in .env picks the
// default; services can also request a specific provider by name for
// fallback logic.

import { ElectricityProviderInterface } from "./ElectricityProviderInterface";
import { VTpassProvider } from "./VTpassProvider";
import { env } from "../config/env";
import { ApiError } from "../utils/apiError";

const registry = new Map<string, ElectricityProviderInterface>();

registry.set("vtpass", new VTpassProvider());
// Future: registry.set("paybeta", new PaybetaProvider());
// Future: registry.set("powershop", new PowershopProvider());

export function getProvider(name?: string): ElectricityProviderInterface {
  const key = name ?? env.activeElectricityProvider;
  const provider = registry.get(key);
  if (!provider) {
    throw ApiError.internal(`Unknown electricity provider "${key}"`);
  }
  return provider;
}

export function listProviders(): Array<{ name: string; configured: boolean }> {
  return Array.from(registry.values()).map((p) => ({
    name: p.name,
    configured: p.isConfigured(),
  }));
}
