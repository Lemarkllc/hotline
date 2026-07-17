import type { NextFunction, Request, Response } from "express";
import type { Channel } from "@hotline/shared";
import { config } from "@/config/unifiedConfig.js";
import { userRepository } from "@/repositories/UserRepository.js";
import { authService } from "@/services/authService.js";
import { ForbiddenError, UnauthorizedError } from "@/types/index.js";
import { asyncErrorWrapper } from "./asyncErrorWrapper.js";

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

/** Web-клиенты (HRD/менеджер/администратор): JWT access-токен в Authorization. */
export const requireWebAuth = asyncErrorWrapper(async (req, _res, next) => {
  const token = bearerToken(req);
  if (!token) throw new UnauthorizedError();
  const { userId } = authService.verifyAccessToken(token);
  const authContext = await userRepository.getAuthContext(userId);
  if (!authContext) throw new UnauthorizedError("Учётная запись не найдена или заблокирована");
  req.user = authContext;
  next();
});

/**
 * Боты (bot-employee / bot-customer) — доверенные сервисы, не конечные пользователи.
 * Аутентифицируются статическим service-token'ом, канал передаётся явно заголовком,
 * чтобы bot-employee физически не мог обратиться от имени канала CUSTOMER и наоборот.
 */
export function requireBotService(channel: Channel) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = req.header("x-bot-service-token");
    if (!token || token !== config.auth.botServiceToken) {
      next(new UnauthorizedError("Недействительный service-token бота"));
      return;
    }
    req.botService = { channel };
    next();
  };
}

export function requireAnyAuth(req: Request, _res: Response, next: NextFunction): void {
  if (req.user || req.botService) {
    next();
    return;
  }
  next(new ForbiddenError());
}
