import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";
import { ApiError } from "../utils/apiError";

// Validates req.body against a zod schema and replaces it with the
// parsed (typed, defaulted) value.
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return next(ApiError.badRequest(message, "VALIDATION_ERROR", result.error.issues));
    }
    req.body = result.data;
    return next();
  };
}
