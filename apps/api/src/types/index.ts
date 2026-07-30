import type { Channel, Permission } from "@hotline/shared";

export interface AuthenticatedUser {
  id: string;
  fullName: string;
  email: string | null;
  roleNames: string[];
  permissions: Permission[];
  channels: Channel[];
}

/** Контекст запроса, пришедшего от доверенного бот-сервиса от имени Telegram-пользователя. */
export interface BotServiceContext {
  channel: Channel;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      botService?: BotServiceContext;
      requestId: string;
    }
  }
}

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
    /** Машиночитаемый код для веток UI, где текста сообщения недостаточно (например,
     * различить "неверный пароль" от "нужно настроить 2FA" — оба технически 401/403). */
    public readonly code?: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Доступ запрещён", code?: string) {
    super(403, message, undefined, code);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Не найдено") {
    super(404, message);
  }
}

export class ValidationError extends HttpError {
  constructor(message = "Некорректные данные", details?: unknown) {
    super(422, message, details);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "Требуется аутентификация") {
    super(401, message);
  }
}

export class ConflictError extends HttpError {
  constructor(message = "Конфликт состояния") {
    super(409, message);
  }
}
