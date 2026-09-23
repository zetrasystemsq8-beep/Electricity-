// Section 20: "Your electricity, finally explained" monthly statement -
// built entirely from real successful transactions and usage records.
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";

export async function getMonthlyReport(userId: string, meterId: string, month?: number, year?: number) {
  const meter = await prisma.meter.findFirst({ where: { id: meterId, userId } });
  if (!meter) throw ApiError.notFound("Meter not found.");

  const now = new Date();
  const targetMonth = month ?? now.getMonth() + 1;
  const targetYear = year ?? now.getFullYear();

  const start = new Date(targetYear, targetMonth - 1, 1);
  const end = new Date(targetYear, targetMonth, 1);
  const prevStart = new Date(targetYear, targetMonth - 2, 1);
  const prevEnd = start;

  const [thisMonthTxns, prevMonthTxns] = await Promise.all([
    prisma.transactionRecord.findMany({
      where: { status: "SUCCESSFUL", createdAt: { gte: start, lt: end }, purchase: { meterId, userId } },
    }),
    prisma.transactionRecord.findMany({
      where: { status: "SUCCESSFUL", createdAt: { gte: prevStart, lt: prevEnd }, purchase: { meterId, userId } },
    }),
  ]);

  const spent = thisMonthTxns.reduce((sum, t) => sum + (t.amountPaid ?? 0), 0);
  const unitsPurchased = thisMonthTxns.reduce((sum, t) => sum + (t.unitsKwh ?? 0), 0);
  const prevSpent = prevMonthTxns.reduce((sum, t) => sum + (t.amountPaid ?? 0), 0);

  const usageRecords = await prisma.usageRecord.findMany({
    where: { meterId, periodStart: { gte: start }, periodEnd: { lte: end } },
  });
  const totalConsumedKwh = usageRecords.reduce((sum, r) => sum + r.kwhConsumed, 0);
  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
  const averageDailyUsageKwh = usageRecords.length > 0 ? totalConsumedKwh / daysInMonth : null;

  return {
    meter: { id: meter.id, label: meter.label },
    period: { month: targetMonth, year: targetYear },
    amountSpent: Number(spent.toFixed(0)),
    unitsPurchasedKwh: Number(unitsPurchased.toFixed(1)),
    averageDailyUsageKwh: averageDailyUsageKwh !== null ? Number(averageDailyUsageKwh.toFixed(2)) : null,
    numberOfPurchases: thisMonthTxns.length,
    comparedToLastMonth:
      prevSpent > 0 ? Number((((spent - prevSpent) / prevSpent) * 100).toFixed(1)) : null,
  };
}
