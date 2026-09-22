// Section 23, 42, 43: the estimation engine.
// Every number this module returns is tagged with its BalanceSource so the
// frontend can never present an estimate as a live meter reading.

import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";

export interface BalanceView {
  balanceKwh: number;
  source: "LIVE_METER" | "ESTIMATED" | "USER_ENTERED_READING";
  asOf: Date;
  estimatedDaysRemaining: number | null;
  averageDailyUsageKwh: number | null;
}

/**
 * Record a new reference point after a successful purchase:
 * new balance = previous known balance + units just purchased.
 * If we have no previous balance at all, the purchase units become the
 * starting point.
 */
export async function recordPurchaseBalanceSnapshot(meterId: string, unitsPurchased: number) {
  const latest = await prisma.balanceSnapshot.findFirst({
    where: { meterId },
    orderBy: { createdAt: "desc" },
  });

  const projectedConsumptionSinceLast = latest
    ? await estimateConsumptionSince(meterId, latest.createdAt)
    : 0;

  const startingPoint = latest ? latest.balanceKwh - projectedConsumptionSinceLast : 0;
  const newBalance = Math.max(0, startingPoint) + unitsPurchased;

  return prisma.balanceSnapshot.create({
    data: {
      meterId,
      balanceKwh: newBalance,
      source: "ESTIMATED",
      note: "Calculated after a purchase: previous estimated balance + units purchased.",
    },
  });
}

/** Section 43: user manually enters what their CIU currently shows. */
export async function recordUserReading(meterId: string, balanceKwh: number) {
  if (balanceKwh < 0) throw ApiError.badRequest("Balance can't be negative.");

  const previous = await prisma.balanceSnapshot.findFirst({
    where: { meterId },
    orderBy: { createdAt: "desc" },
  });

  const snapshot = await prisma.balanceSnapshot.create({
    data: {
      meterId,
      balanceKwh,
      source: "USER_ENTERED_READING",
      note: "Entered directly by the customer from their meter display.",
    },
  });

  // If we have a prior snapshot, turn the gap into a real UsageRecord so the
  // analytics engine has genuine consumption data instead of guessing.
  if (previous && previous.balanceKwh >= balanceKwh) {
    const consumed = previous.balanceKwh - balanceKwh;
    if (consumed > 0) {
      await prisma.usageRecord.create({
        data: {
          meterId,
          periodStart: previous.createdAt,
          periodEnd: snapshot.createdAt,
          kwhConsumed: consumed,
          source: "USER_ENTERED_READING",
        },
      });
    }
  }

  return snapshot;
}

/** Average daily kWh usage over the last N days of recorded UsageRecords. */
export async function getAverageDailyUsage(meterId: string, days = 14): Promise<number | null> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const records = await prisma.usageRecord.findMany({
    where: { meterId, periodEnd: { gte: since } },
  });
  if (records.length === 0) return null;

  const totalKwh = records.reduce((sum, r) => sum + r.kwhConsumed, 0);
  const spanMs = Math.max(
    1,
    records.reduce((max, r) => Math.max(max, r.periodEnd.getTime()), 0) -
      records.reduce((min, r) => Math.min(min, r.periodStart.getTime()), Date.now())
  );
  const spanDays = Math.max(1, spanMs / (24 * 60 * 60 * 1000));
  return totalKwh / spanDays;
}

async function estimateConsumptionSince(meterId: string, since: Date): Promise<number> {
  const avgDaily = await getAverageDailyUsage(meterId);
  if (avgDaily === null) return 0;
  const days = Math.max(0, (Date.now() - since.getTime()) / (24 * 60 * 60 * 1000));
  return avgDaily * days;
}

/** The single function the Home dashboard calls (section 5). */
export async function getCurrentBalanceView(meterId: string): Promise<BalanceView | null> {
  const latest = await prisma.balanceSnapshot.findFirst({
    where: { meterId },
    orderBy: { createdAt: "desc" },
  });
  if (!latest) return null;

  const avgDaily = await getAverageDailyUsage(meterId);

  // Project consumption forward from the last known snapshot so "balance
  // remaining" keeps counting down between purchases/readings, still
  // clearly labelled ESTIMATED (never LIVE_METER, since we have no live feed).
  let projectedBalance = latest.balanceKwh;
  let source: BalanceView["source"] = latest.source as BalanceView["source"];

  if (latest.source !== "LIVE_METER" && avgDaily !== null) {
    const daysSince = (Date.now() - latest.createdAt.getTime()) / (24 * 60 * 60 * 1000);
    projectedBalance = Math.max(0, latest.balanceKwh - avgDaily * daysSince);
    source = "ESTIMATED";
  }

  return {
    balanceKwh: Number(projectedBalance.toFixed(2)),
    source,
    asOf: latest.createdAt,
    averageDailyUsageKwh: avgDaily,
    estimatedDaysRemaining: avgDaily && avgDaily > 0 ? Number((projectedBalance / avgDaily).toFixed(1)) : null,
  };
}
