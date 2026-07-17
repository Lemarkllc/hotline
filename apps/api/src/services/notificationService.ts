import { notificationRepository } from "@/repositories/NotificationRepository.js";
import { appealRepository } from "@/repositories/AppealRepository.js";
import { userRepository } from "@/repositories/UserRepository.js";

/**
 * Уведомления — очередь в БД (Notification, статус PENDING), а не прямая отправка
 * из API. Доставка: боту — через поллинг GET /notifications/pending (bot-service auth),
 * веб-панели — через GET /notifications текущего пользователя. Разделение соответствует
 * архитектуре §24 (BOT --> API, а не наоборот) и даёт ретраи "из коробки" (attempts/lastError).
 */
export class NotificationService {
  private async hrdRecipients(channel: "EMPLOYEE" | "CUSTOMER") {
    return userRepository.findByRoleAndChannel("HRD", channel);
  }

  async notifyHrdNewAppeal(appealId: string): Promise<void> {
    const appeal = await appealRepository.findById(appealId);
    if (!appeal) return;
    const recipients = await this.hrdRecipients(appeal.channel);
    await Promise.all(
      recipients.map((r) =>
        notificationRepository.create({
          userId: r.id,
          appealId,
          channel: "WEB",
          payload: { type: "new_appeal", publicNumber: appeal.publicNumber },
        }),
      ),
    );
  }

  async notifyStatusChanged(appealId: string, toStatus: string): Promise<void> {
    const appeal = await appealRepository.findById(appealId);
    if (!appeal?.authorUserId) return;
    await notificationRepository.create({
      userId: appeal.authorUserId,
      appealId,
      channel: "TELEGRAM",
      payload: { type: "status_changed", publicNumber: appeal.publicNumber, toStatus },
    });
  }

  async notifyAssigned(appealId: string, assigneeUserId: string): Promise<void> {
    const appeal = await appealRepository.findById(appealId);
    if (!appeal) return;
    await notificationRepository.create({
      userId: assigneeUserId,
      appealId,
      channel: "WEB",
      payload: { type: "assigned", publicNumber: appeal.publicNumber },
    });
  }

  async notifyAuthorMessage(appealId: string, text: string): Promise<void> {
    const appeal = await appealRepository.findById(appealId);
    if (!appeal?.authorUserId) return;
    await notificationRepository.create({
      userId: appeal.authorUserId,
      appealId,
      channel: "TELEGRAM",
      payload: { type: "hrd_message", publicNumber: appeal.publicNumber, text },
    });
  }

  async notifyHrdAuthorReplied(appealId: string): Promise<void> {
    const appeal = await appealRepository.findById(appealId);
    if (!appeal) return;
    const recipients = await this.hrdRecipients(appeal.channel);
    await Promise.all(
      recipients.map((r) =>
        notificationRepository.create({
          userId: r.id,
          appealId,
          channel: "WEB",
          payload: { type: "author_replied", publicNumber: appeal.publicNumber },
        }),
      ),
    );
  }

  async notifyLowRating(appealId: string, score: number): Promise<void> {
    const appeal = await appealRepository.findById(appealId);
    if (!appeal) return;
    const recipients = await this.hrdRecipients(appeal.channel);
    await Promise.all(
      recipients.map((r) =>
        notificationRepository.create({
          userId: r.id,
          appealId,
          channel: "WEB",
          payload: { type: "low_rating", publicNumber: appeal.publicNumber, score },
        }),
      ),
    );
  }

  async notifyAccessDecision(userId: string, approved: boolean): Promise<void> {
    await notificationRepository.create({
      userId,
      channel: "TELEGRAM",
      payload: { type: approved ? "access_approved" : "access_rejected" },
    });
  }

  listPendingForBot(channel: "TELEGRAM" | "WEB" = "TELEGRAM") {
    return notificationRepository.listPending().then((items) =>
      items.filter((i) => i.channel === channel),
    );
  }

  ack(notificationId: string) {
    return notificationRepository.markSent(notificationId);
  }

  fail(notificationId: string, error: string) {
    return notificationRepository.markFailed(notificationId, error);
  }

  listForWebUser(userId: string, onlyUnread = false) {
    return notificationRepository.listForUser(userId, onlyUnread);
  }

  markRead(notificationId: string) {
    return notificationRepository.markSent(notificationId);
  }
}

export const notificationService = new NotificationService();
