import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../middleware/errorHandler";
import * as meterService from "../services/meterService";
import { getGuideForMeter, setMeterModel, listMeterModels } from "../services/meterGuideService";
import { recordUserReading } from "../services/estimationService";
import { getCurrentBalanceView } from "../services/estimationService";

const router = Router();
router.use(requireAuth);

router.get("/discos", asyncHandler(async (_req, res) => res.json(await meterService.listDiscos())));
router.get("/models", asyncHandler(async (_req, res) => res.json(await listMeterModels())));

router.get("/", asyncHandler(async (req, res) => res.json(await meterService.listMeters(req.user!.userId))));

router.get(
  "/:id",
  asyncHandler(async (req, res) => res.json(await meterService.getMeter(req.user!.userId, req.params.id)))
);

const addMeterSchema = z.object({
  label: z.string().min(1).max(50),
  meterNumber: z.string().min(5).max(20),
  discoId: z.string().uuid(),
  phoneNumber: z.string().optional(),
});

router.post(
  "/",
  validateBody(addMeterSchema),
  asyncHandler(async (req, res) => {
    const meter = await meterService.addMeter(req.user!.userId, req.body);
    res.status(201).json(meter);
  })
);

router.post(
  "/:id/verify",
  asyncHandler(async (req, res) => {
    const meter = await meterService.verifyMeter(req.user!.userId, req.params.id);
    res.json(meter);
  })
);

router.patch(
  "/:id",
  validateBody(z.object({ label: z.string().min(1).max(50) })),
  asyncHandler(async (req, res) => {
    const meter = await meterService.updateMeterLabel(req.user!.userId, req.params.id, req.body.label);
    res.json(meter);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await meterService.removeMeter(req.user!.userId, req.params.id);
    res.status(204).send();
  })
);

router.get(
  "/:id/balance",
  asyncHandler(async (req, res) => {
    const balance = await getCurrentBalanceView(req.params.id);
    res.json(balance);
  })
);

router.post(
  "/:id/reading",
  validateBody(z.object({ balanceKwh: z.number().nonnegative() })),
  asyncHandler(async (req, res) => {
    const snapshot = await recordUserReading(req.params.id, req.body.balanceKwh);
    res.status(201).json(snapshot);
  })
);

router.get(
  "/:id/guide",
  asyncHandler(async (req, res) => res.json(await getGuideForMeter(req.user!.userId, req.params.id)))
);

router.post(
  "/:id/model",
  validateBody(z.object({ meterModelId: z.string().uuid() })),
  asyncHandler(async (req, res) => {
    const meter = await setMeterModel(req.user!.userId, req.params.id, req.body.meterModelId);
    res.json(meter);
  })
);

export default router;
