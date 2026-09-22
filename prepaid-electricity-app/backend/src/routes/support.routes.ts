import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../middleware/errorHandler";
import * as supportService from "../services/supportService";
import { SupportCategory } from "@prisma/client";

const router = Router();
router.use(requireAuth);

router.get("/self-help", asyncHandler(async (_req, res) => res.json(supportService.listSelfHelpTopics())));
router.get(
  "/self-help/:topic",
  asyncHandler(async (req, res) => res.json(supportService.getSelfHelp(req.params.topic)))
);

router.get(
  "/tickets",
  asyncHandler(async (req, res) => res.json(await supportService.listMySupportTickets(req.user!.userId)))
);

router.get(
  "/tickets/:id",
  asyncHandler(async (req, res) => res.json(await supportService.getSupportTicket(req.user!.userId, req.params.id)))
);

const createTicketSchema = z.object({
  category: z.nativeEnum(SupportCategory),
  description: z.string().min(5).max(2000),
});

router.post(
  "/tickets",
  validateBody(createTicketSchema),
  asyncHandler(async (req, res) => {
    const ticket = await supportService.createSupportTicket(req.user!.userId, req.body);
    res.status(201).json(ticket);
  })
);

export default router;
