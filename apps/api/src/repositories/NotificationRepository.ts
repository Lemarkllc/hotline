import type { Notification, NotificationChannel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma.js";

const PENDING_INCLUDE = { user: { select: { telegramId: true } } } satisfies Prisma.NotificationInclude;
export type PendingNotification = Prisma.NotificationGetPayload<{ include: typeof PENDING_INCLUDE }>;

export class NotificationRepository {
  create(data: {
    userId?: string | null;
    appealId?: string | null;
    channel: NotificationChannel;
    payload: Prisma.InputJsonValue;
  }) {
    return prisma.notification.create({ data });
  }

  /** include user.telegramId — боту нужен именно он, chatId для private-чата всегда равен telegramId. */
  listPending(limit = 50): Promise<PendingNotification[]> {
    return prisma.notification.findMany({
      where: { status: "PENDING" },
      include: PENDING_INCLUDE,
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  }

  /** Для WEB-канала: PENDING == непрочитано, SENT == прочитано (см. NotificationController). */
  listForUser(userId: string, onlyUnread = false): Promise<Notification[]> {
    return prisma.notification.findMany({
      where: { userId, channel: "WEB", ...(onlyUnread ? { status: "PENDING" } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  /** Бейдж непрочитанных на карточке обращения в Реестре/Kanban — считает по уже
   * существующим WEB-уведомлениям, отдельного счётчика/поля не заводим. */
  async countPendingByAppeal(userId: string, appealIds: string[]): Promise<Map<string, number>> {
    if (!appealIds.length) return new Map();
    const rows = await prisma.notification.groupBy({
      by: ["appealId"],
      where: { userId, appealId: { in: appealIds }, channel: "WEB", status: "PENDING" },
      _count: { _all: true },
    });
    return new Map(rows.filter((r) => r.appealId).map((r) => [r.appealId as string, r._count._all]));
  }

  /** Открытие карточки обращения = прочитано — гасит все WEB-уведомления по этому
   * обращению для текущего пользователя одним запросом (а не по одному через markSent). */
  markAllReadForAppeal(userId: string, appealId: string): Promise<Prisma.BatchPayload> {
    return prisma.notification.updateMany({
      where: { userId, appealId, channel: "WEB", status: "PENDING" },
      data: { status: "SENT", sentAt: new Date() },
    });
  }

  markSent(id: string): Promise<Notification> {
    return prisma.notification.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date() },
    });
  }

  markFailed(id: string, error: string): Promise<Notification> {
    return prisma.notification.update({
      where: { id },
      data: { status: "FAILED", lastError: error, attempts: { increment: 1 } },
    });
  }
}

export const notificationRepository = new NotificationRepository();
