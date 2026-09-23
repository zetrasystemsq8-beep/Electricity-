import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiError";
import { logger } from "../utils/logger";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    if (err.status >= 500) {
      logger.error(err.message, { code: err.code, path: req.path, details: err.details });
    }
    return res.status(err.status).json({
      error: { code: err.code, message: err.message },
    });
  }

  const message = err instanceof Error ? err.message : "Unknown error";
  logger.error("Unhandled error", { message, path: req.path });
  return res.status(500).json({
    error: { code: "INTERNAL", message: "Something went wrong. Please try again." },
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "This endpoint does not exist." } });
}

// Wrap async route handlers so thrown errors reach errorHandler
// instead of crashing the process.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
