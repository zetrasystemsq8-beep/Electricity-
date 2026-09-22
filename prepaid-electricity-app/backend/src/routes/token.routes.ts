import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../middleware/errorHandler";
import * as tokenService from "../services/tokenService";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const meterId = typeof req.query.meterId === "string" ? req.query.meterId : undefined;
    res.json(await tokenService.listTokenVault(req.user!.userId, meterId));
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => res.json(await tokenService.getToken(req.user!.userId, req.params.id)))
);

router.post(
  "/:id/loaded",
  validateBody(z.object({ loaded: z.boolean() })),
  asyncHandler(async (req, res) => {
    const token = await tokenService.markTokenLoaded(req.user!.userId, req.params.id, req.body.loaded);
    res.json(token);
  })
);

export default router;
