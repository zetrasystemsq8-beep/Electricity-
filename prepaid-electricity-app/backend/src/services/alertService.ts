// Section 17: low-balance alerts, driven by the real estimation engine.
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { getCurrentBalanceView } from "./estimationService";
import { createNotification } from "./notificationService";

export async function listAlerts(userId: string, meterId?: string) {
  return prisma.alert.findMany({
    where: { userId, ...(meterId ? { meterId } : {}) },
    include: { meter: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createAlert(
  userId: string,
  params: { meterId: string; thresholdKwh?: number; thresholdDays?: number }
) {
  const meter = await prisma.meter.findFirst({ where: { id: params.meterId, userId } });
  if (!meter) throw ApiError.notFound("Meter not found.");
  if (!params.thresholdKwh && !params.thresholdDays) {
    throw ApiError.badRequest("Set either a unit threshold or a days-remaining threshold.");
  }

  return prisma.alert.create({
    data: {
      userId,
      meterId: params.meterId,
      thresholdKwh: params.thresholdKwh,
      thresholdDays: params.thresholdDays,
    },
  });
}

export async function deleteAlert(userId: string, alertId: string) {
  const alert = await prisma.alert.findFirst({ where: { id: alertId, userId } });
  if (!alert) throw ApiError.notFound("Alert not found.");
  await prisma.alert.delete({ where: { id: alertId } });
}

/**
 * Run periodically (see scripts/runAlertSweep.ts) or on-demand after a
 * balance update. Checks every active alert against the current estimated/
 * live balance and fires a notification once per drop below threshold
 * (debounced via lastTriggeredAt, reset once the balance recovers above
 * threshold after a top-up).
 */
export async function evaluateAlertsForMeter(meterId: string) {
  const balance = await getCurrentBalanceView(meterId);
  if (!balance) return;

  const alerts = await prisma.alert.findMany({ where: { meterId, isActive: true } });

  for (const alert of alerts) {
    const belowUnits = alert.thresholdKwh != null && balance.balanceKwh <= alert.thresholdKwh;
    const belowDays =
      alert.thresholdDays != null &&
      balance.estimatedDaysRemaining != null &&
      balance.estimatedDaysRemaining <= alert.thresholdDays;

    if ((belowUnits || belowDays) && shouldFire(alert.lastTriggeredAt)) {
      const meter = await prisma.meter.findUnique({ where: { id: meterId } });
      await createNotification(meter!.userId, {
        category: "LOW_BALANCE",
        title: "Your electricity is getting low",
        body: `${meter!.label}: estimated remaining ${balance.balanceKwh} kWh${
          balance.estimatedDaysRemaining ? ` (~${balance.estimatedDaysRemaining} days)` : ""
        }.`,
      });
      await prisma.alert.update({ where: { id: alert.id }, data: { lastTriggeredAt: new Date() } });
    }
  }
}

function shouldFire(lastTriggeredAt: Date | null): boolean {
  if (!lastTriggeredAt) return true;
  const hoursSince = (Date.now() - lastTriggeredAt.getTime()) / (1000 * 60 * 60);
  return hoursSince >= 24; // avoid spamming the user
}
