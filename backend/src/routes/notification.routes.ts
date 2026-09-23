import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { listNotifications, markNotificationRead } from "../services/notificationService";

const router = Router();
router.use(requireAuth);

router.get("/", asyncHandler(async (req, res) => res.json(await listNotifications(req.user!.userId))));

router.post(
  "/:id/read",
  asyncHandler(async (req, res) => res.json(await markNotificationRead(req.user!.userId, req.params.id)))
);

export default router;
