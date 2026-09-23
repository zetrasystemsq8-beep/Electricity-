// Section 16: appliance-based estimation. Estimate only, always labelled.
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";

export async function listAppliances(userId: string, meterId: string) {
  const meter = await prisma.meter.findFirst({ where: { id: meterId, userId } });
  if (!meter) throw ApiError.notFound("Meter not found.");
  return prisma.appliance.findMany({ where: { meterId }, orderBy: { createdAt: "asc" } });
}

export async function addAppliance(
  userId: string,
  meterId: string,
  params: { name: string; wattage?: number; hoursPerDay?: number; quantity?: number }
) {
  const meter = await prisma.meter.findFirst({ where: { id: meterId, userId } });
  if (!meter) throw ApiError.notFound("Meter not found.");

  return prisma.appliance.create({
    data: {
      meterId,
      name: params.name,
      wattage: params.wattage,
      hoursPerDay: params.hoursPerDay,
      quantity: params.quantity ?? 1,
    },
  });
}

export async function removeAppliance(userId: string, applianceId: string) {
  const appliance = await prisma.appliance.findFirst({
    where: { id: applianceId, meter: { userId } },
  });
  if (!appliance) throw ApiError.notFound("Appliance not found.");
  await prisma.appliance.delete({ where: { id: applianceId } });
}

/**
 * Estimated daily kWh from appliance wattage x hours. Only appliances with
 * both wattage and hoursPerDay supplied contribute - we never guess a
 * missing wattage.
 */
export async function estimateDailyConsumptionFromAppliances(userId: string, meterId: string) {
  const appliances = await listAppliances(userId, meterId);

  const usable = appliances.filter((a) => a.wattage != null && a.hoursPerDay != null);
  const skipped = appliances.length - usable.length;

  const totalWh = usable.reduce((sum, a) => sum + (a.wattage as number) * (a.hoursPerDay as number) * a.quantity, 0);

  return {
    estimatedDailyKwh: Number((totalWh / 1000).toFixed(2)),
    appliancesConsidered: usable.length,
    appliancesSkippedMissingData: skipped,
    isEstimate: true,
  };
}
