// Section 28: admin dashboard read models.
import { prisma } from "../lib/prisma";
import { listProviders } from "../providers/ProviderRegistry";

export async function getAdminOverview() {
  const [totalUsers, activeUsers, suspendedUsers, totalMeters, verifiedMeters, txnCounts, revenue] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { status: "SUSPENDED" } }),
      prisma.meter.count({ where: { isActive: true } }),
      prisma.meter.count({ where: { verificationStatus: "VERIFIED" } }),
      prisma.transactionRecord.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.transactionRecord.aggregate({ where: { status: "SUCCESSFUL" }, _sum: { amountPaid: true } }),
    ]);

  return {
    users: { total: totalUsers, active: activeUsers, suspended: suspendedUsers },
    meters: { total: totalMeters, verified: verifiedMeters },
    transactions: Object.fromEntries(txnCounts.map((t) => [t.status, t._count._all])),
    revenue: { totalSuccessfulVolume: revenue._sum.amountPaid ?? 0 },
    providers: listProviders(),
  };
}

export async function listAdminUsers(params: { limit?: number; status?: "ACTIVE" | "SUSPENDED" }) {
  return prisma.user.findMany({
    where: params.status ? { status: params.status } : undefined,
    select: { id: true, phoneNumber: true, fullName: true, status: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 100,
  });
}

export async function setUserStatus(userId: string, status: "ACTIVE" | "SUSPENDED") {
  return prisma.user.update({ where: { id: userId }, data: { status } });
}

export async function listAdminTransactions(params: { status?: string; limit?: number }) {
  return prisma.transactionRecord.findMany({
    where: params.status ? { status: params.status as never } : undefined,
    include: { purchase: { include: { meter: true, user: { select: { fullName: true, phoneNumber: true } } } } },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 100,
  });
}

export async function listAdminSupportTickets(params: { status?: string; limit?: number }) {
  return prisma.supportTicket.findMany({
    where: params.status ? { status: params.status as never } : undefined,
    include: { user: { select: { fullName: true, phoneNumber: true } } },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 100,
  });
}

export async function updateSupportTicketStatus(ticketId: string, status: "OPEN" | "PROCESSING" | "RESOLVED") {
  return prisma.supportTicket.update({ where: { id: ticketId }, data: { status } });
}

export async function getProviderHealth() {
  const logs = await prisma.providerCallLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const byProvider = new Map<string, { total: number; failures: number; avgLatency: number }>();
  for (const log of logs) {
    const entry = byProvider.get(log.providerName) ?? { total: 0, failures: 0, avgLatency: 0 };
    entry.total += 1;
    if (!log.success) entry.failures += 1;
    entry.avgLatency += log.latencyMs;
    byProvider.set(log.providerName, entry);
  }

  return Array.from(byProvider.entries()).map(([providerName, stats]) => ({
    providerName,
    totalCalls: stats.total,
    failureRate: Number(((stats.failures / stats.total) * 100).toFixed(1)),
    avgLatencyMs: Number((stats.avgLatency / stats.total).toFixed(0)),
  }));
}
