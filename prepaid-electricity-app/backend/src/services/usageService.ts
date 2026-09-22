// Section 14, 15, 21, 22: usage analytics, built only from real
// UsageRecord/BalanceSnapshot rows - never fabricated.

import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { getAverageDailyUsage } from "./estimationService";

type Period = "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "PREVIOUS_MONTH";

function periodRange(period: Period): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  switch (period) {
    case "TODAY":
      start.setHours(0, 0, 0, 0);
      return { start, end: now };
    case "THIS_WEEK": {
      const day = now.getDay();
      start.setDate(now.getDate() - day);
      start.setHours(0, 0, 0, 0);
      return { start, end: now };
    }
    case "THIS_MONTH":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      return { start, end: now };
    case "PREVIOUS_MONTH": {
      const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { start: firstOfPrevMonth, end: firstOfThisMonth };
    }
  }
}

export async function getUsageSummary(userId: string, meterId: string, period: Period) {
  const meter = await prisma.meter.findFirst({ where: { id: meterId, userId } });
  if (!meter) throw ApiError.notFound("Meter not found.");

  const { start, end } = periodRange(period);

  const records = await prisma.usageRecord.findMany({
    where: { meterId, periodStart: { gte: start }, periodEnd: { lte: end } },
  });

  const totalKwh = records.reduce((sum, r) => sum + r.kwhConsumed, 0);
  const spanDays = Math.max(1, (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  const averageDailyKwh = records.length > 0 ? totalKwh / spanDays : null;

  return {
    period,
    start,
    end,
    totalKwh: Number(totalKwh.toFixed(2)),
    averageDailyKwh: averageDailyKwh !== null ? Number(averageDailyKwh.toFixed(2)) : null,
    dataPoints: records.length,
    note:
      records.length === 0
        ? "No usage data recorded yet for this period. Enter a meter reading to start tracking."
        : undefined,
  };
}

/** Section 15: "why are my units finishing fast?" - only ever compares real numbers. */
export async function getUsageComparison(userId: string, meterId: string) {
  const meter = await prisma.meter.findFirst({ where: { id: meterId, userId } });
  if (!meter) throw ApiError.notFound("Meter not found.");

  const recentAvg = await getAverageDailyUsage(meterId, 7);
  const baselineAvg = await getAverageDailyUsage(meterId, 30);

  if (recentAvg === null || baselineAvg === null || baselineAvg === 0) {
    return {
      hasEnoughData: false,
      message: "We need a bit more usage history before we can compare your recent consumption.",
    };
  }

  const percentChange = ((recentAvg - baselineAvg) / baselineAvg) * 100;

  return {
    hasEnoughData: true,
    normalDailyKwh: Number(baselineAvg.toFixed(2)),
    currentDailyKwh: Number(recentAvg.toFixed(2)),
    percentChange: Number(percentChange.toFixed(1)),
    direction: percentChange > 5 ? "UP" : percentChange < -5 ? "DOWN" : "STEADY",
  };
}

/** Section 22: recharge frequency, based on real purchase timestamps. */
export async function getRechargePattern(userId: string, meterId: string) {
  const purchases = await prisma.purchase.findMany({
    where: { meterId, userId, transaction: { status: "SUCCESSFUL" } },
    orderBy: { createdAt: "asc" },
  });

  if (purchases.length < 2) {
    return { hasEnoughData: false as const };
  }

  const gaps: number[] = [];
  for (let i = 1; i < purchases.length; i++) {
    const gapDays =
      (purchases[i].createdAt.getTime() - purchases[i - 1].createdAt.getTime()) / (24 * 60 * 60 * 1000);
    gaps.push(gapDays);
  }
  const avgGapDays = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const avgAmount = purchases.reduce((sum, p) => sum + p.amountRequested, 0) / purchases.length;

  return {
    hasEnoughData: true as const,
    averageRechargeGapDays: Number(avgGapDays.toFixed(1)),
    averageRechargeAmount: Number(avgAmount.toFixed(0)),
    totalRecharges: purchases.length,
  };
}
