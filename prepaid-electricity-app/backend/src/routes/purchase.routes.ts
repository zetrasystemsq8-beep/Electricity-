import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../middleware/errorHandler";
import { initiatePurchase, confirmPaymentAndVend } from "../services/purchaseService";
import { isPaystackConfigured, env } from "../config/env";
import { ApiError } from "../utils/apiError";

const router = Router();
router.use(requireAuth);

const initiateSchema = z.object({
  meterId: z.string().uuid(),
  amount: z.number().positive(),
});

// Section 7: Step 1-3. Creates the pending transaction and returns what the
// frontend needs to open the payment processor's checkout.
router.post(
  "/initiate",
  validateBody(initiateSchema),
  asyncHandler(async (req, res) => {
    const result = await initiatePurchase(req.user!.userId, req.body);
    res.status(201).json({
      ...result,
      paymentConfigured: isPaystackConfigured(),
      paystackPublicNote: isPaystackConfigured()
        ? undefined
        : "Payment collection isn't configured yet - add PAYSTACK_SECRET_KEY to the backend .env to accept real payments.",
    });
  })
);

// Section 7: Step 4-5. Called by the frontend after the payment processor's
// checkout reports success; the server independently re-verifies with the
// processor (see paymentVerification below) before ever calling the
// vending provider.
const confirmSchema = z.object({
  transactionId: z.string().uuid(),
  processorRef: z.string().min(1),
});

router.post(
  "/confirm",
  validateBody(confirmSchema),
  asyncHandler(async (req, res) => {
    if (!isPaystackConfigured()) {
      throw ApiError.providerNotConfigured("Paystack");
    }

    const verified = await verifyPaystackTransaction(req.body.processorRef);
    if (!verified.success) {
      throw ApiError.badRequest("Payment could not be verified. Please try again.", "PAYMENT_NOT_VERIFIED");
    }

    const result = await confirmPaymentAndVend({
      userId: req.user!.userId,
      transactionId: req.body.transactionId,
      processorRef: req.body.processorRef,
      amountConfirmed: verified.amount,
    });
    res.json(result);
  })
);

/**
 * Real call to Paystack's verify endpoint - not a mock. Throws a clear
 * provider-not-configured error above if no secret key is present.
 */
async function verifyPaystackTransaction(reference: string): Promise<{ success: boolean; amount: number }> {
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${env.paystack.secretKey}` },
  });
  if (!res.ok) {
    throw ApiError.providerFailure("Paystack", `HTTP ${res.status} verifying payment`);
  }
  const data = (await res.json()) as {
    status: boolean;
    data?: { status: string; amount: number };
  };
  const ok = data.status && data.data?.status === "success";
  return { success: Boolean(ok), amount: (data.data?.amount ?? 0) / 100 };
}

export default router;
