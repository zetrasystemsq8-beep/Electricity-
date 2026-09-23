import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../middleware/errorHandler";
import { setBudget, getBudgetStatus } from "../services/budgetService";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const meterId = typeof req.query.meterId === "string" ? req.query.meterId : undefined;
    res.json(await getBudgetStatus(req.user!.userId, meterId));
  })
);

const setSchema = z.object({
  monthlyLimit: z.number().positive(),
  meterId: z.string().uuid().optional(),
});

router.post(
  "/",
  validateBody(setSchema),
  asyncHandler(async (req, res) => {
    const budget = await setBudget(req.user!.userId, req.body);
    res.status(201).json(budget);
  })
);

export default router;
