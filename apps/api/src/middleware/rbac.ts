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
