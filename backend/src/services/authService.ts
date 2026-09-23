import { prisma } from "../lib/prisma";
import { hashPassword, verifyPassword } from "../utils/password";
import { signAuthToken } from "../utils/jwt";
import { ApiError } from "../utils/apiError";

export async function registerUser(params: {
  phoneNumber: string;
  fullName: string;
  password: string;
}) {
  const existing = await prisma.user.findUnique({ where: { phoneNumber: params.phoneNumber } });
  if (existing) {
    throw ApiError.conflict("An account with this phone number already exists.");
  }

  const passwordHash = await hashPassword(params.password);
  const user = await prisma.user.create({
    data: {
      phoneNumber: params.phoneNumber,
      fullName: params.fullName,
      passwordHash,
    },
  });

  const token = signAuthToken({ userId: user.id, role: user.role });
  return { token, user: sanitizeUser(user) };
}

export async function loginUser(params: { phoneNumber: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { phoneNumber: params.phoneNumber } });
  if (!user) {
    throw ApiError.badRequest("Incorrect phone number or password.", "INVALID_CREDENTIALS");
  }
  if (user.status === "SUSPENDED") {
    throw ApiError.forbidden("This account has been suspended. Contact support.");
  }

  const valid = await verifyPassword(params.password, user.passwordHash);
  if (!valid) {
    throw ApiError.badRequest("Incorrect phone number or password.", "INVALID_CREDENTIALS");
  }

  const token = signAuthToken({ userId: user.id, role: user.role });
  return { token, user: sanitizeUser(user) };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("User not found.");
  return sanitizeUser(user);
}

function sanitizeUser(user: { passwordHash: string; [k: string]: unknown }) {
  const { passwordHash, ...rest } = user;
  return rest;
}
