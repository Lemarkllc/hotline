import type { Request } from "express";

/** Общий контекст для записей audit_log — вызывающий сервис дополняет action/object. */
export function getAuditContext(req: Request) {
  return {
    requestId: req.requestId,
    ipAddress: req.ip,
    userAgent: req.header("user-agent") ?? undefined,
  };
}
