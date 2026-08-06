import type { Notification, NotificationChannel, Prisma } from "@prisma/client";
import type { Channel } from "@hotline/shared";
import { prisma } from "@/lib/prisma.js";

// include user.telegramId и externalContact.telegramId — боту нужен именно telegramId,
// chatId для private-чата всегда ему равен. Ровно один из двух заполнен на строку
// (Фаза 7, PLAN.md §6: EMPLOYEE через user, CUSTOMER через externalContact).
const PENDING_INCLUDE = {
  user: { select: { telegramId: true } },
  externalContact: { select: { telegramId: true } },
} satisfies Prisma.NotificationInclude;
export type PendingNotification = Prisma.NotificationGetPayload<{ include: typeof PENDING_INCLUDE }>;

export class NotificationRepository {
  create(data: {
    userId?: string | null;
    externalContactId?: string | null;
    appealId?: string | null;
    emailLeadId?: string | null;
    channel: NotificationChannel;
    payload: Prisma.InputJsonValue;
  }) {
    return prisma.notification.create({ data });
  }

  /**
   * channel обязателен — bot-employee и bot-customer опрашивают ЭТОТ метод независимо
   * друг от друга (Фаза 7), и до этой правки оба видели ВЕСЬ общий PENDING-список без
   * фильтра: чужой бот получал notification, ловил "нет telegramId" (userId и
   * externalContactId взаимоисключающие), тихо ничего не делал в своём handler'е — но
   * поллер (packages/bot-core) всё равно вызывал ack() на успешно (без throw)
   * отработавший handler. Уведомление помечалось SENT, реально не будучи доставленным,
   * и настоящий адресат-бот на следующем тике уже не видел его в PENDING. Отсюда
   * "иногда не доходит" — вероятностная гонка между двумя поллерами, а не постоянный сбой.
   */
  listPending(channel: Channel, limit = 50): Promise<PendingNotification[]> {
    return prisma.notification.findMany({
      where: {
        status: "PENDING",
        ...(channel === "EMPLOYEE" ? { userId: { not: null } } : { externalContactId: { not: null } }),
      },
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

  /** Типы непрочитанных WEB-уведомлений по обращению — для потабовых точек
   * ("Переписка"/"Внутренняя работа") на карточке. Вызывать ДО markAllReadForAppeal,
   * иначе список уже будет пуст. */
  async listPendingTypesForAppeal(userId: string, appealId: string): Promise<string[]> {
    const rows = await prisma.notification.findMany({
      where: { userId, appealId, channel: "WEB", status: "PENDING" },
      select: { payload: true },
    });
    return rows
      .map((r) => (r.payload as { type?: string } | null)?.type)
      .filter((type): type is string => Boolean(type));
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
