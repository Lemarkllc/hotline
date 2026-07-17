import type { Response } from "express";
import { reportError } from "@/lib/logger.js";
import { HttpError } from "@/types/index.js";

/** Все контроллеры наследуются отсюда — единственное место, где формируется res.json. */
export abstract class BaseController {
  protected handleSuccess<T>(res: Response, data: T, statusCode = 200): void {
    res.status(statusCode).json(data);
  }

  protected handleError(error: unknown, res: Response, action: string): void {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({
        error: error.name,
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return;
    }
    reportError(error, { action });
    res.status(500).json({ error: "internal_error", message: "Внутренняя ошибка сервера" });
  }
}
