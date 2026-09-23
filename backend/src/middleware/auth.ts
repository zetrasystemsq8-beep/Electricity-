import { NextFunction, Request, Response } from "express";
import { verifyAuthToken, AuthTokenPayload } from "../utils/jwt";
import { ApiError } from "../utils/apiError";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(ApiError.unauthorized());
  }
  const token = header.slice("Bearer ".length);
  try {
    req.user = verifyAuthToken(token);
    return next();
  } catch {
    return next(ApiError.unauthorized("Your session has expired. Please sign in again."));
  }
}

export function requireRole(...roles: Array<"CUSTOMER" | "ADMIN" | "SUPPORT_AGENT">) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(ApiError.forbidden());
    }
    return next();
  };
}
