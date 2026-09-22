// Paystack webhook - the more reliable way payment confirmation reaches us
// in production (the /confirm endpoint called from the frontend is the
// synchronous path; this is the async fallback in case the app closes
// before /confirm fires). Section 27: "webhook validation".
import { Router } from "express";
import crypto from "crypto";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { confirmPaymentAndVend } from "../services/purchaseService";
import { logger } from "../utils/logger";

const router = Router();

router.post("/paystack", async (req, res) => {
  if (!env.paystack.webhookSecret) {
    logger.warn("Received Paystack webhook but PAYSTACK_WEBHOOK_SECRET is not set - ignoring.");
    return res.status(503).json({ error: "Webhook not configured" });
  }

  const signature = req.headers["x-paystack-signature"];
  const expected = crypto
    .createHmac("sha512", env.paystack.webhookSecret)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (signature !== expected) {
    logger.warn("Invalid Paystack webhook signature");
    return res.status(401).json({ error: "Invalid signature" });
  }

  const event = req.body as { event: string; data?: { reference?: string; amount?: number; metadata?: { transactionId?: string; userId?: string } } };

  if (event.event === "charge.success" && event.data?.reference) {
    // The frontend must pass { transactionId, userId } as Paystack metadata
    // when it opens checkout (see frontend/src/pages/Confirm.tsx) - that's
    // how the webhook maps a processor reference back to our transaction
    // before any Payment row necessarily exists yet.
    const metaTxnId = event.data.metadata?.transactionId;
    const txn = metaTxnId
      ? await prisma.transactionRecord.findUnique({ where: { id: metaTxnId }, include: { purchase: true } })
      : null;

    if (txn && txn.status !== "SUCCESSFUL") {
      try {
        await confirmPaymentAndVend({
          userId: txn.purchase.userId,
          transactionId: txn.id,
          processorRef: event.data.reference,
          amountConfirmed: (event.data.amount ?? 0) / 100,
        });
      } catch (err) {
        logger.error("Webhook-triggered vend failed", { error: (err as Error).message, txnId: txn.id });
      }
    }
  }

  // Always 200 quickly so the processor doesn't retry unnecessarily.
  res.status(200).json({ received: true });
});

export default router;
