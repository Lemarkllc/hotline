import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

type Source = "body" | "query" | "params";

/** Все внешние входные данные проходят через Zod (backend-dev-guidelines §7). */
export function validate(schema: ZodTypeAny, source: Source = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.parse(req[source]);
    (req as unknown as Record<Source, unknown>)[source] = parsed;
    next();
  };
}
