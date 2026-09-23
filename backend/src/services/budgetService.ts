// Section 21: monthly electricity budget tracking, backed by real
// successful-transaction sums for the given month.
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";

export async function setBudget(
  userId: string,
  params: { monthlyLimit: number; meterId?: string; month?: number; year?: number }
) {
  const now = new Date();
  const periodMonth = params.month ?? now.getMonth() + 1;
  const periodYear = params.year ?? now.getFullYear();

  if (params.meterId) {
    const meter = await prisma.meter.findFirst({ where: { id: params.meterId, userId } });
    if (!meter) throw ApiError.notFound("Meter not found.");
  }

  return prisma.budget.upsert({
    where: {
      userId_meterId_periodMonth_periodYear: {
        userId,
        meterId: params.meterId ?? null as unknown as string,
        periodMonth,
        periodYear,
      },
    },
    update: { monthlyLimit: params.monthlyLimit },
    create: {
      userId,
      meterId: params.meterId,
      monthlyLimit: params.monthlyLimit,
      periodMonth,
      periodYear,
    },
  });
}

export async function getBudgetStatus(userId: string, meterId?: string) {
  const now = new Date();
  const periodMonth = now.getMonth() + 1;
  const periodYear = now.getFullYear();

  const budget = await prisma.budget.findFirst({
    where: { userId, meterId: meterId ?? null, periodMonth, periodYear },
  });
  if (!budget) return null;

  const start = new Date(periodYear, periodMonth - 1, 1);
  const end = new Date(periodYear, periodMonth, 1);

  const spent = await prisma.transactionRecord.aggregate({
    where: {
      status: "SUCCESSFUL",
      createdAt: { gte: start, lt: end },
      purchase: { userId, ...(meterId ? { meterId } : {}) },
    },
    _sum: { amountPaid: true },
  });

  const spentAmount = spent._sum.amountPaid ?? 0;

  return {
    monthlyLimit: budget.monthlyLimit,
    spent: spentAmount,
    remaining: Math.max(0, budget.monthlyLimit - spentAmount),
    percentUsed: Number(((spentAmount / budget.monthlyLimit) * 100).toFixed(1)),
    periodMonth,
    periodYear,
  };
}
