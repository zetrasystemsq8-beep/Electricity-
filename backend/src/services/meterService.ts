import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { getProvider } from "../providers/ProviderRegistry";
import { logger } from "../utils/logger";

export async function listMeters(userId: string) {
  return prisma.meter.findMany({
    where: { userId, isActive: true },
    include: { disco: true, meterModel: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getMeter(userId: string, meterId: string) {
  const meter = await prisma.meter.findFirst({
    where: { id: meterId, userId },
    include: { disco: true, meterModel: true },
  });
  if (!meter) throw ApiError.notFound("Meter not found.");
  return meter;
}

export async function addMeter(userId: string, params: {
  label: string;
  meterNumber: string;
  discoId: string;
  phoneNumber?: string;
}) {
  const disco = await prisma.disco.findUnique({ where: { id: params.discoId } });
  if (!disco || !disco.isActive) {
    throw ApiError.badRequest("Please choose a valid DISCO.", "INVALID_DISCO");
  }

  const existing = await prisma.meter.findFirst({
    where: { userId, meterNumber: params.meterNumber, discoId: params.discoId },
  });
  if (existing) {
    throw ApiError.conflict("You've already added this meter.");
  }

  const meter = await prisma.meter.create({
    data: {
      userId,
      label: params.label,
      meterNumber: params.meterNumber,
      discoId: params.discoId,
      phoneNumber: params.phoneNumber,
      verificationStatus: "UNVERIFIED",
    },
    include: { disco: true },
  });

  return meter;
}

export async function verifyMeter(userId: string, meterId: string) {
  const meter = await prisma.meter.findFirst({
    where: { id: meterId, userId },
    include: { disco: true },
  });
  if (!meter) throw ApiError.notFound("Meter not found.");

  const provider = getProvider();

  try {
    const result = await provider.verifyMeter(meter.meterNumber, meter.disco.shortCode);

    const updated = await prisma.meter.update({
      where: { id: meter.id },
      data: {
        customerName: result.customerName,
        address: result.address,
        meterType: result.meterType ?? "UNKNOWN",
        minimumPurchase: result.minimumPurchase,
        verificationStatus: "VERIFIED",
        verifiedAt: new Date(),
        verificationRaw: JSON.stringify(result.raw),
      },
      include: { disco: true, meterModel: true },
    });

    return updated;
  } catch (err) {
    await prisma.meter.update({
      where: { id: meter.id },
      data: { verificationStatus: "FAILED" },
    });
    logger.warn("Meter verification failed", { meterId, error: (err as Error).message });
    throw err;
  }
}

export async function updateMeterLabel(userId: string, meterId: string, label: string) {
  const meter = await prisma.meter.findFirst({ where: { id: meterId, userId } });
  if (!meter) throw ApiError.notFound("Meter not found.");
  return prisma.meter.update({ where: { id: meterId }, data: { label } });
}

export async function removeMeter(userId: string, meterId: string) {
  const meter = await prisma.meter.findFirst({ where: { id: meterId, userId } });
  if (!meter) throw ApiError.notFound("Meter not found.");
  await prisma.meter.update({ where: { id: meterId }, data: { isActive: false } });
}

export async function listDiscos() {
  return prisma.disco.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
}
