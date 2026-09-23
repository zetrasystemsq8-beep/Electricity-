import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../middleware/errorHandler";
import { initiatePurchase, confirmPaymentAndVend } from "../services/purchaseService";
import { isPaystackConfigured, env } from "../config/env";
import { ApiError } from "../utils/apiError";
import { getCurrentUser } from "../services/authService";

const router = Router();
router.use(requireAuth);

const initiateSchema = z.object({
  meterId: z.string().uuid(),
  amount: z.number().positive(),
});

/**
 * Real call to Paystack's transaction/initialize endpoint. This is the
 * mobile-friendly checkout path: Paystack's inline JS widget only works in
 * a browser, so a Flutter client instead opens the returned
 * authorization_url in an in-app webview and we catch the redirect.
 * Never returns fabricated data - throws if Paystack isn't configured or
 * rejects the request.
 */
async function initializePaystackTransaction(params: {
  email: string;
  amountNaira: number;
  reference: string;
  transactionId: string;
  userId: string;
}): Promise<{ authorizationUrl: string; accessCode: string }> {
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.paystack.secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: Math.round(params.amountNaira * 100), // kobo
      reference: params.reference,
      // The Flutter app's webview watches for a URL starting with this
      // scheme and treats it as "payment attempt finished" - see
      // flutter_app/lib/screens/payment_webview_screen.dart
      callback_url: "https://powerpal.app/payment-callback",
      metadata: { transactionId: params.transactionId, userId: params.userId },
    }),
  });

  if (!res.ok) {
    throw ApiError.providerFailure("Paystack", `HTTP ${res.status} initializing payment`);
  }

  const data = (await res.json()) as {
    status: boolean;
    data?: { authorization_url: string; access_code: string };
    message?: string;
  };

  if (!data.status || !data.data) {
    throw ApiError.providerFailure("Paystack", data.message ?? "Could not start payment.");
  }

  return { authorizationUrl: data.data.authorization_url, accessCode: data.data.access_code };
}

// Section 7: Step 1-3. Creates the pending transaction and, if Paystack is
// configured, a real hosted checkout session for it.
router.post(
  "/initiate",
  validateBody(initiateSchema),
  asyncHandler(async (req, res) => {
    const result = await initiatePurchase(req.user!.userId, req.body);

    if (!isPaystackConfigured()) {
      return res.status(201).json({
        ...result,
        paymentConfigured: false,
        paystackPublicNote:
          "Payment collection isn't configured yet - add PAYSTACK_SECRET_KEY to the backend .env to accept real payments.",
      });
    }

    const user = await getCurrentUser(req.user!.userId);
    const checkout = await initializePaystackTransaction({
      email: `${(user as { phoneNumber: string }).phoneNumber}@powerpal.ng`,
      amountNaira: result.amount,
      reference: result.internalRef,
      transactionId: result.transactionId,
      userId: req.user!.userId,
    });

    res.status(201).json({
      ...result,
      paymentConfigured: true,
      checkoutUrl: checkout.authorizationUrl,
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
