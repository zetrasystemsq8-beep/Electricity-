import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../middleware/errorHandler";
import { getUsageSummary, getUsageComparison, getRechargePattern } from "../services/usageService";
import { getMonthlyReport } from "../services/reportService";
import * as applianceService from "../services/applianceService";

const router = Router();
router.use(requireAuth);

router.get(
  "/:meterId/summary",
  asyncHandler(async (req, res) => {
    const period = (req.query.period as string) ?? "THIS_WEEK";
    res.json(await getUsageSummary(req.user!.userId, req.params.meterId, period as never));
  })
);

router.get(
  "/:meterId/comparison",
  asyncHandler(async (req, res) => res.json(await getUsageComparison(req.user!.userId, req.params.meterId)))
);

router.get(
  "/:meterId/recharge-pattern",
  asyncHandler(async (req, res) => res.json(await getRechargePattern(req.user!.userId, req.params.meterId)))
);

router.get(
  "/:meterId/monthly-report",
  asyncHandler(async (req, res) => {
    const month = req.query.month ? Number(req.query.month) : undefined;
    const year = req.query.year ? Number(req.query.year) : undefined;
    res.json(await getMonthlyReport(req.user!.userId, req.params.meterId, month, year));
  })
);

router.get(
  "/:meterId/appliances",
  asyncHandler(async (req, res) => res.json(await applianceService.listAppliances(req.user!.userId, req.params.meterId)))
);

const applianceSchema = z.object({
  name: z.string().min(1),
  wattage: z.number().positive().optional(),
  hoursPerDay: z.number().positive().max(24).optional(),
  quantity: z.number().int().positive().optional(),
});

router.post(
  "/:meterId/appliances",
  validateBody(applianceSchema),
  asyncHandler(async (req, res) => {
    const appliance = await applianceService.addAppliance(req.user!.userId, req.params.meterId, req.body);
    res.status(201).json(appliance);
  })
);

router.delete(
  "/appliances/:applianceId",
  asyncHandler(async (req, res) => {
    await applianceService.removeAppliance(req.user!.userId, req.params.applianceId);
    res.status(204).send();
  })
);

router.get(
  "/:meterId/appliance-estimate",
  asyncHandler(async (req, res) =>
    res.json(await applianceService.estimateDailyConsumptionFromAppliances(req.user!.userId, req.params.meterId))
  )
);

export default router;
