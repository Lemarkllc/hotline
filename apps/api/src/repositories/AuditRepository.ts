import type { AuditLog, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma.js";

export interface AuditEntryInput {
  actorId?: string | null;
  action: string;
  objectType: string;
  objectId?: string | null;
  appealId?: string | null;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  result: "success" | "failure";
  metadata?: Prisma.InputJsonValue;
  reason?: string | null;
}

/** Append-only на уровне приложения (SRS §37) — намеренно нет update/delete. */
export class AuditRepository {
  create(entry: AuditEntryInput): Promise<AuditLog> {
    return prisma.auditLog.create({ data: entry });
  }

  list(filters: { action?: string; actorId?: string; appealId?: string }, page: number, pageSize: number) {
    return prisma.auditLog.findMany({
      where: {
        ...(filters.action ? { action: filters.action } : {}),
        ...(filters.actorId ? { actorId: filters.actorId } : {}),
        ...(filters.appealId ? { appealId: filters.appealId } : {}),
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }
}

export const auditRepository = new AuditRepository();
