import type { Request } from "express";
import { ValidationError } from "@/types/index.js";

/**
 * `noUncheckedIndexedAccess` делает req.params[key] типом `string | undefined`
 * (params — индексная сигнатура). Роут гарантирует наличие параметра, если сматчился,
 * поэтому здесь только сужение типа + защита на случай программной ошибки в роутинге.
 */
export function pathParam(req: Request, name: string): string {
  const value = req.params[name];
  if (!value) {
    throw new ValidationError(`Отсутствует обязательный параметр пути: ${name}`);
  }
  return value;
}
