import type { NextFunction, Request, Response } from "express";
import type { Channel, Permission } from "@hotline/shared";
import { hasChannelPermission } from "@/utils/authz.js";
import { ForbiddenError, UnauthorizedError } from "@/types/index.js";

/**
 * Требует permission, скоуплённый по каналу (PLAN.md §3, §6). Канал берётся из
 * query/body `channel`, по умолчанию EMPLOYEE — единственный канал MVP.
 */
export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    const channel = ((req.query.channel as string) || (req.body as { channel?: string })?.channel || "EMPLOYEE") as Channel;
    if (!hasChannelPermission(req.user, permission, channel)) {
      next(new ForbiddenError(`Недостаточно прав: требуется ${permission} для канала ${channel}`));
      return;
    }
    next();
  };
}

/**
 * Требует permission БЕЗ канальной проверки — см. PLAIN_PERMISSIONS (packages/shared/
 * permissions.ts) для полного и единственного актуального списка: "lead.manage"
 * («Заявки», email-лиды), "vacation.manage" («Отпуска»), "user.manage" (управление
 * пользователями — системное, не привязано к появлению обращений в конкретном
 * канале), "audit.read" (аудит-лог общий на всё приложение). requirePermission()
 * здесь семантически не подходит: он дефолтит на канал EMPLOYEE, а значит потеря
 * последнего user_channel_access молча гасила бы весь раздел "Администрирование" —
 * ровно так один раз лишился доступа к /users собственный аккаунт Администратора
 * на проде (найдено вживую; ту же ошибку раньше избежали для lead.manage/
 * vacation.manage, но не для user.manage — до этого исправления).
 */
export function requirePlainPermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    if (!req.user.permissions.includes(permission)) {
      next(new ForbiddenError(`Недостаточно прав: требуется ${permission}`));
      return;
    }
    next();
  };
}
