import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { getTransactionHistory, getTransactionDetail } from "../services/transactionService";
import { ApiError } from "../utils/apiError";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => res.json(await getTransactionHistory(req.user!.userId)))
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const txn = await getTransactionDetail(req.user!.userId, req.params.id);
    if (!txn) throw ApiError.notFound("Transaction not found.");
    res.json(txn);
  })
);

export default router;
