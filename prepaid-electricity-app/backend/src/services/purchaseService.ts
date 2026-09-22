// Sections 6, 7, 27: the purchase flow. Payment is verified before we ever
// call the vending provider - we never show "successful" just because
// payment was initiated (section 26).

import { v4 as uuid } from "uuid";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { getProvider } from "../providers/ProviderRegistry";
import {
  createPendingTransaction,
  transitionTransaction,
} from "./transactionService";
import { recordPurchaseBalanceSnapshot } from "./estimationService";
import { createNotification } from "./notificationService";
import { logger } from "../utils/logger";

/**
 * Step 1 of the purchase flow: create the Purchase + a PENDING
 * TransactionRecord + a Payment row, and return what the frontend needs to
 * hand off to the payment processor. We do NOT call the vending provider
 * here - that only happens once payment is confirmed (see
 * confirmPaymentAndVend below), matching section 7 step 4/5.
 */
export async function initiatePurchase(userId: string, params: { meterId: string; amount: number }) {
  const meter = await prisma.meter.findFirst({
    where: { id: params.meterId, userId },
    include: { disco: true },
  });
  if (!meter) throw ApiError.notFound("Meter not found.");
  if (meter.verificationStatus !== "VERIFIED") {
    throw ApiError.badRequest(
      "Please verify this meter before buying electricity.",
      "METER_NOT_VERIFIED"
    );
  }
  if (params.amount <= 0) {
    throw ApiError.badRequest("Enter an amount greater than zero.");
  }
  if (meter.minimumPurchase && params.amount < meter.minimumPurchase) {
    throw ApiError.badRequest(`The minimum purchase for this meter is ₦${meter.minimumPurchase}.`);
  }

  const provider = getProvider();
  if (!provider.isConfigured()) {
    throw ApiError.providerNotConfigured(provider.name);
  }

  const purchase = await prisma.purchase.create({
    data: { userId, meterId: meter.id, amountRequested: params.amount },
  });

  const internalRef = `PUR-${purchase.id}-${uuid().slice(0, 8)}`;
  const txn = await createPendingTransaction({
    purchaseId: purchase.id,
    internalRef,
    providerName: provider.name,
  });

  return {
    purchaseId: purchase.id,
    transactionId: txn.id,
    internalRef,
    amount: params.amount,
    meter: { id: meter.id, label: meter.label, meterNumber: meter.meterNumber, disco: meter.disco.name },
  };
}

/**
 * Called once the payment processor confirms funds were received
 * (either via webhook or a client-side confirm call that we re-verify
 * server-side against the processor). Only then do we call the vending
 * provider. This function is idempotent on transactionId.
 */
export async function confirmPaymentAndVend(params: {
  userId: string;
  transactionId: string;
  processorRef: string;
  amountConfirmed: number;
}) {
  const txn = await prisma.transactionRecord.findFirst({
    where: { id: params.transactionId, purchase: { userId: params.userId } },
    include: { purchase: { include: { meter: { include: { disco: true } } } }, payment: true },
  });
  if (!txn) throw ApiError.notFound("Transaction not found.");

  if (txn.status === "SUCCESSFUL") {
    // Idempotent: already vended, just return current state.
    return prisma.transactionRecord.findUnique({
      where: { id: txn.id },
      include: { token: false },
    });
  }
  if (txn.status !== "PENDING" && txn.status !== "PROCESSING") {
    throw ApiError.conflict(`This transaction is already ${txn.status.toLowerCase()}.`);
  }

  if (!txn.payment) {
    await prisma.payment.create({
      data: {
        transactionId: txn.id,
        processor: "paystack",
        processorRef: params.processorRef,
        amount: params.amountConfirmed,
        status: "SUCCESSFUL",
        webhookVerified: true,
      },
    });
  }

  await transitionTransaction(txn.id, "PROCESSING", {
    amountPaid: params.amountConfirmed,
    note: "Payment confirmed, calling vending provider",
  });

  const provider = getProvider(txn.providerName.toLowerCase());
  const meter = txn.purchase.meter;

  try {
    const result = await provider.vendElectricity({
      meterNumber: meter.meterNumber,
      discoShortCode: meter.disco.shortCode,
      amount: txn.purchase.amountRequested,
      phoneNumber: meter.phoneNumber ?? undefined,
      internalRef: txn.internalRef,
    });

    if (result.status === "FAILED") {
      await transitionTransaction(txn.id, "FAILED", {
        providerTransactionId: result.providerTransactionId,
        failureReason: "Provider declined the vend request.",
        raw: result.raw,
      });
      throw ApiError.providerFailure(provider.name, "Vending failed. If you were charged, this will be refunded.");
    }

    if (result.status === "PENDING") {
      await transitionTransaction(txn.id, "PENDING", {
        providerTransactionId: result.providerTransactionId,
        note: "Provider is still processing - will be requeried.",
        raw: result.raw,
      });
      return prisma.transactionRecord.findUnique({ where: { id: txn.id } });
    }

    // SUCCESSFUL
    const updated = await transitionTransaction(txn.id, "SUCCESSFUL", {
      providerTransactionId: result.providerTransactionId,
      unitsKwh: result.unitsKwh,
      electricityCreditRaw: result.electricityCreditRaw,
      otherChargesRaw: result.otherChargesRaw,
      raw: result.raw,
      note: "Provider confirmed delivery",
    });

    if (result.token) {
      await prisma.token.create({
        data: {
          purchaseId: txn.purchaseId,
          meterId: meter.id,
          tokenValue: result.token,
          units: result.unitsKwh,
          amount: txn.purchase.amountRequested,
          loadingStatus: "NOT_LOADED",
        },
      });
    }

    if (result.unitsKwh) {
      await recordPurchaseBalanceSnapshot(meter.id, result.unitsKwh);
    }

    await createNotification(params.userId, {
      category: "TRANSACTION",
      title: "Purchase successful",
      body: `Your ₦${txn.purchase.amountRequested} purchase for ${meter.label} was successful.`,
    });

    if (result.token) {
      await createNotification(params.userId, {
        category: "TOKEN",
        title: "Your token is ready",
        body: `Token for ${meter.label}: ${result.token}`,
      });
    }

    return updated;
  } catch (err) {
    if (!(err instanceof ApiError)) {
      logger.error("Unexpected vend error", { error: (err as Error).message, transactionId: txn.id });
      await transitionTransaction(txn.id, "FAILED", {
        failureReason: "Unexpected error during vending.",
      });
    }
    throw err;
  }
}
