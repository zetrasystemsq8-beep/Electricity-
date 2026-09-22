// Section 26, 40: the transaction engine. TransactionRecord rows are never
// mutated after creation for their core financial fields - status changes
// are appended as TransactionEvent rows so we always have a full audit
// trail for reconciliation.

import { prisma } from "../lib/prisma";
import { TransactionStatus } from "@prisma/client";

export async function createPendingTransaction(params: {
  purchaseId: string;
  internalRef: string;
  providerName: string;
}) {
  const txn = await prisma.transactionRecord.create({
    data: {
      purchaseId: params.purchaseId,
      internalRef: params.internalRef,
      providerName: params.providerName,
      status: "PENDING",
    },
  });

  await prisma.transactionEvent.create({
    data: { transactionId: txn.id, toStatus: "PENDING", note: "Transaction created" },
  });

  return txn;
}

export async function transitionTransaction(
  transactionId: string,
  toStatus: TransactionStatus,
  fields: {
    providerTransactionId?: string;
    amountPaid?: number;
    unitsKwh?: number;
    electricityCreditRaw?: number;
    otherChargesRaw?: number;
    failureReason?: string;
    note?: string;
    raw?: unknown;
  } = {}
) {
  const current = await prisma.transactionRecord.findUniqueOrThrow({ where: { id: transactionId } });

  const updated = await prisma.transactionRecord.update({
    where: { id: transactionId },
    data: {
      status: toStatus,
      providerTransactionId: fields.providerTransactionId ?? current.providerTransactionId,
      amountPaid: fields.amountPaid ?? current.amountPaid,
      unitsKwh: fields.unitsKwh ?? current.unitsKwh,
      electricityCreditRaw: fields.electricityCreditRaw ?? current.electricityCreditRaw,
      otherChargesRaw: fields.otherChargesRaw ?? current.otherChargesRaw,
      failureReason: fields.failureReason ?? current.failureReason,
    },
  });

  await prisma.transactionEvent.create({
    data: {
      transactionId,
      fromStatus: current.status,
      toStatus,
      note: fields.note,
      raw: fields.raw ? JSON.stringify(fields.raw) : undefined,
    },
  });

  return updated;
}

export async function getTransactionHistory(userId: string, limit = 50) {
  return prisma.transactionRecord.findMany({
    where: { purchase: { userId } },
    include: { purchase: { include: { meter: { include: { disco: true } } } }, payment: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getTransactionDetail(userId: string, transactionId: string) {
  return prisma.transactionRecord.findFirst({
    where: { id: transactionId, purchase: { userId } },
    include: {
      purchase: { include: { meter: { include: { disco: true } } } },
      events: { orderBy: { createdAt: "asc" } },
      payment: true,
    },
  });
}
