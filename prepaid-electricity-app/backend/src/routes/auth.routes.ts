import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { registerUser, loginUser, getCurrentUser } from "../services/authService";

const router = Router();

const registerSchema = z.object({
  phoneNumber: z.string().min(10).max(15),
  fullName: z.string().min(2).max(100),
  password: z.string().min(6).max(100),
});

const loginSchema = z.object({
  phoneNumber: z.string().min(10).max(15),
  password: z.string().min(6).max(100),
});

router.post(
  "/register",
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const result = await registerUser(req.body);
    res.status(201).json(result);
  })
);

router.post(
  "/login",
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await loginUser(req.body);
    res.json(result);
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req.user!.userId);
    res.json(user);
  })
);

export default router;
