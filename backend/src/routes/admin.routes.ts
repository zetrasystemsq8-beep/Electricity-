import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../middleware/errorHandler";
import * as adminService from "../services/adminService";

const router = Router();
router.use(requireAuth, requireRole("ADMIN"));

router.get("/overview", asyncHandler(async (_req, res) => res.json(await adminService.getAdminOverview())));

router.get(
  "/users",
  asyncHandler(async (req, res) => {
    const status = req.query.status as "ACTIVE" | "SUSPENDED" | undefined;
    res.json(await adminService.listAdminUsers({ status }));
  })
);

router.post(
  "/users/:id/status",
  validateBody(z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) })),
  asyncHandler(async (req, res) => res.json(await adminService.setUserStatus(req.params.id, req.body.status)))
);

router.get(
  "/transactions",
  asyncHandler(async (req, res) => {
    const status = req.query.status as string | undefined;
    res.json(await adminService.listAdminTransactions({ status }));
  })
);

router.get(
  "/support-tickets",
  asyncHandler(async (req, res) => {
    const status = req.query.status as string | undefined;
    res.json(await adminService.listAdminSupportTickets({ status }));
  })
);

router.post(
  "/support-tickets/:id/status",
  validateBody(z.object({ status: z.enum(["OPEN", "PROCESSING", "RESOLVED"]) })),
  asyncHandler(async (req, res) =>
    res.json(await adminService.updateSupportTicketStatus(req.params.id, req.body.status))
  )
);

router.get("/provider-health", asyncHandler(async (_req, res) => res.json(await adminService.getProviderHealth())));

export default router;
