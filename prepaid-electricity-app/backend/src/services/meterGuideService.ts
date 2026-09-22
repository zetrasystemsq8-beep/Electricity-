// Section 12: per-meter-model guides. Steps are only ever sourced from
// MeterModel rows with a verifiedSource citation - never guessed for an
// unrecognized meter (rule #48: "Never guess a code").
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";

export async function getGuideForMeter(userId: string, meterId: string) {
  const meter = await prisma.meter.findFirst({
    where: { id: meterId, userId },
    include: { meterModel: true, disco: true },
  });
  if (!meter) throw ApiError.notFound("Meter not found.");

  if (!meter.meterModel) {
    return {
      hasVerifiedGuide: false,
      message:
        "We haven't confirmed the exact model of this meter yet, so we can't show its specific balance-check code. Use Support > I don't understand my meter for general help, or tell us your meter's brand from Meter settings.",
    };
  }

  return {
    hasVerifiedGuide: true,
    manufacturer: meter.meterModel.manufacturer,
    modelName: meter.meterModel.modelName,
    balanceCheckSteps: JSON.parse(meter.meterModel.balanceCheckSteps) as string[],
    tokenLoadSteps: JSON.parse(meter.meterModel.tokenLoadSteps) as string[],
    source: meter.meterModel.verifiedSource,
  };
}

export async function setMeterModel(userId: string, meterId: string, meterModelId: string) {
  const meter = await prisma.meter.findFirst({ where: { id: meterId, userId } });
  if (!meter) throw ApiError.notFound("Meter not found.");
  const model = await prisma.meterModel.findUnique({ where: { id: meterModelId } });
  if (!model) throw ApiError.notFound("Meter model not found.");
  return prisma.meter.update({ where: { id: meterId }, data: { meterModelId } });
}

export async function listMeterModels() {
  return prisma.meterModel.findMany({ orderBy: [{ manufacturer: "asc" }, { modelName: "asc" }] });
}
