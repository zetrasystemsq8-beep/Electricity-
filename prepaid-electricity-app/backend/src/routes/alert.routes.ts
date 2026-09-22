import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../middleware/errorHandler";
import * as alertService from "../services/alertService";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const meterId = typeof req.query.meterId === "string" ? req.query.meterId : undefined;
    res.json(await alertService.listAlerts(req.user!.userId, meterId));
  })
);

const createSchema = z.object({
  meterId: z.string().uuid(),
  thresholdKwh: z.number().positive().optional(),
  thresholdDays: z.number().positive().optional(),
});

router.post(
  "/",
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const alert = await alertService.createAlert(req.user!.userId, req.body);
    res.status(201).json(alert);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await alertService.deleteAlert(req.user!.userId, req.params.id);
    res.status(204).send();
  })
);

export default router;
