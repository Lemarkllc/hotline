import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { reportError } from "@/lib/logger.js";
import { HttpError } from "@/types/index.js";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(422).json({
      error: "validation_error",
      requestId: req.requestId,
      details: err.flatten(),
    });
    return;
  }

  if (err instanceof HttpError) {
    if (err.statusCode >= 500) {
      reportError(err, { requestId: req.requestId, path: req.path });
    }
    res.status(err.statusCode).json({
      error: err.name,
      code: err.code,
      message: err.message,
      requestId: req.requestId,
      details: err.details,
    });
    return;
  }

  reportError(err, { requestId: req.requestId, path: req.path });
  res.status(500).json({
    error: "internal_error",
    message: "Внутренняя ошибка сервера",
    requestId: req.requestId,
  });
}
