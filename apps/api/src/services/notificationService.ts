import type { Prisma } from "@prisma/client";
import type { Channel } from "@hotline/shared";
import { notificationRepository } from "@/repositories/NotificationRepository.js";
import { appealRepository } from "@/repositories/AppealRepository.js";
import { userRepository } from "@/repositories/UserRepository.js";
import { pushService } from "@/services/pushService.js";

/**
 * Уведомления — очередь в БД (Notification, статус PENDING), а не прямая отправка
 * из API. Доставка: боту — через поллинг GET /notifications/pending (bot-service auth),
 * веб-панели — через GET /notifications текущего пользователя (плюс браузерный web push,
 * best-effort, см. pushService). Разделение соответствует архитектуре §24 (BOT --> API,
 * а не наоборот) и даёт ретраи "из коробки" (attempts/lastError).
 */
export class NotificationService {
  /** HRD + Administrator (последний — с тех пор как ему выдан appeal.read_all ради
   * ОБТ, см. packages/shared/permissions.ts): оба "наблюдают" за потоком обращений,
   * поэтому оба должны видеть колокольчик/push, а не только HRD. */
  private async interestedStaffRecipients(channel: "EMPLOYEE" | "CUSTOMER") {
    const [hrd, admins] = await Promise.all([
      userRepository.findByRoleAndChannel("HRD", channel),
      userRepository.findByRoleAndChannel("ADMINISTRATOR", channel),
    ]);
    const seen = new Set<string>();
    return [...hrd, ...admins].filter((u) => (seen.has(u.id) ? false : (seen.add(u.id), true)));
  }

  /** Роль «Продажи» ведёт канал CUSTOMER единолично (Фаза 7, PLAN.md §6) — не через
   * interestedStaffRecipients (тот HRD/Administrator-специфичный, а у них нет
   * user_channel_access(CUSTOMER) по умолчанию, см. допущение №8 раздела 9 PLAN.md). */
  private salesRecipients() {
    return userRepository.findByRoleAndChannel("SALES", "CUSTOMER");
  }

  /** WEB-уведомление всегда дублируется браузерным push'ем тем же получателям —
   * один источник правды вместо повторения create()+sendToUser() на каждый вызов ниже. */
  private async createWebNotification(
    userId: string,
    appealId: string,
    payload: Prisma.InputJsonValue,
    push: { title: string; body: string },
  ): Promise<void> {
    await notificationRepository.create({ userId, appealId, channel: "WEB", payload });
    await pushService.sendToUser(userId, { ...push, url: `/appeals/${appealId}` });
  }

  async notifyHrdNewAppeal(appealId: string): Promise<void> {
    const appeal = await appealRepository.findById(appealId);
    if (!appeal) return;
    const recipients = await this.interestedStaffRecipients(appeal.channel);
    await Promise.all(
      recipients.map((r) =>
        this.createWebNotification(
          r.id,
          appealId,
          { type: "new_appeal", publicNumber: appeal.publicNumber },
          { title: "Новое обращение", body: `Обращение ${appeal.publicNumber} ждёт классификации` },
        ),
      ),
    );
  }

  async notifyStatusChanged(appealId: string, toStatus: string, finalAnswer?: string): Promise<void> {
    const appeal = await appealRepository.findById(appealId);
    if (!appeal) return;
    // EMPLOYEE — через userId, CUSTOMER — через externalContactId (Фаза 7, PLAN.md §6):
    // автор обращения ровно в одной из этих двух форм, никогда в обеих сразу.
    const recipient = appeal.authorUserId
      ? { userId: appeal.authorUserId }
      : appeal.externalContactId
        ? { externalContactId: appeal.externalContactId }
        : null;
    if (!recipient) return;
    await notificationRepository.create({
      ...recipient,
      appealId,
      channel: "TELEGRAM",
      payload: { type: "status_changed", publicNumber: appeal.publicNumber, toStatus, finalAnswer },
    });
  }

  async notifyAssigned(appealId: string, assigneeUserId: string): Promise<void> {
    const appeal = await appealRepository.findById(appealId);
    if (!appeal) return;
    await this.createWebNotification(
      assigneeUserId,
      appealId,
      { type: "assigned", publicNumber: appeal.publicNumber },
      { title: "Вам назначено обращение", body: `Обращение ${appeal.publicNumber}` },
    );
  }

  /** Публичное сообщение от персонала автору — TELEGRAM, доставка ботом.
   * EMPLOYEE — через userId (payload "hrd_message", bot-employee), CUSTOMER — через
   * externalContactId (payload "sales_message", bot-customer): автор ровно в одной из
   * двух форм, как и everywhere else в Фазе 7. До этой правки здесь проверялся только
   * authorUserId — клиент никогда не получал в Telegram ответы «Продаж» на своё обращение. */
  async notifyAuthorMessage(appealId: string, text: string): Promise<void> {
    const appeal = await appealRepository.findById(appealId);
    if (!appeal) return;
    if (appeal.authorUserId) {
      await notificationRepository.create({
        userId: appeal.authorUserId,
        appealId,
        channel: "TELEGRAM",
        payload: { type: "hrd_message", publicNumber: appeal.publicNumber, text },
      });
    } else if (appeal.externalContactId) {
      await notificationRepository.create({
        externalContactId: appeal.externalContactId,
        appealId,
        channel: "TELEGRAM",
        payload: { type: "sales_message", publicNumber: appeal.publicNumber, text },
      });
    }
  }

  async notifyHrdAuthorReplied(appealId: string): Promise<void> {
    const appeal = await appealRepository.findById(appealId);
    if (!appeal) return;
    const recipients = await this.interestedStaffRecipients(appeal.channel);
    await Promise.all(
      recipients.map((r) =>
        this.createWebNotification(
          r.id,
          appealId,
          { type: "author_replied", publicNumber: appeal.publicNumber },
          { title: "Автор ответил", body: `Обращение ${appeal.publicNumber}` },
        ),
      ),
    );
  }

  /** Ответный аналог notifyHrdAuthorReplied для канала CUSTOMER — «Продажи» ведёт его
   * единолично (см. комментарий у salesRecipients()), поэтому не переиспользует
   * interestedStaffRecipients (тот HRD/Administrator-специфичный). */
  async notifySalesAuthorReplied(appealId: string): Promise<void> {
    const appeal = await appealRepository.findById(appealId);
    if (!appeal) return;
    const recipients = await this.salesRecipients();
    await Promise.all(
      recipients.map((r) =>
        this.createWebNotification(
          r.id,
          appealId,
          { type: "author_replied", publicNumber: appeal.publicNumber },
          { title: "Клиент ответил", body: `Обращение ${appeal.publicNumber}` },
        ),
      ),
    );
  }

  async notifyLowRating(appealId: string, score: number): Promise<void> {
    const appeal = await appealRepository.findById(appealId);
    if (!appeal) return;
    const recipients = await this.interestedStaffRecipients(appeal.channel);
    await Promise.all(
      recipients.map((r) =>
        this.createWebNotification(
          r.id,
          appealId,
          { type: "low_rating", publicNumber: appeal.publicNumber, score },
          { title: "Низкая оценка", body: `Обращение ${appeal.publicNumber}: ${score}/5` },
        ),
      ),
    );
  }

  async notifySalesNewAppeal(appealId: string): Promise<void> {
    const appeal = await appealRepository.findById(appealId);
    if (!appeal) return;
    const recipients = await this.salesRecipients();
    await Promise.all(
      recipients.map((r) =>
        this.createWebNotification(
          r.id,
          appealId,
          { type: "new_appeal", publicNumber: appeal.publicNumber },
          { title: "Новое обращение", body: `Обращение ${appeal.publicNumber} ждёт классификации` },
        ),
      ),
    );
  }

  /** NPS-style — низкая любая из двух оценок (порог ≤2, по аналогии с notifyLowRating). */
  async notifyLowCustomerRating(
    appealId: string,
    wouldRecommendScore: number,
    wouldReturnScore: number,
  ): Promise<void> {
    const appeal = await appealRepository.findById(appealId);
    if (!appeal) return;
    const recipients = await this.salesRecipients();
    await Promise.all(
      recipients.map((r) =>
        this.createWebNotification(
          r.id,
          appealId,
          { type: "low_rating", publicNumber: appeal.publicNumber, wouldRecommendScore, wouldReturnScore },
          {
            title: "Низкая оценка",
            body: `Обращение ${appeal.publicNumber}: рекомендация ${wouldRecommendScore}/5, вернётся ${wouldReturnScore}/5`,
          },
        ),
      ),
    );
  }

  /** TELEGRAM-уведомление с кнопками Подтвердить/Отклонить (см. bot-employee
   * notificationHandler.ts) — только HRD с уже привязанным telegramId получат его,
   * доставка по TELEGRAM-каналу иначе адресовать некому (см. NotificationRepository). */
  async notifyHrdNewAccessRequest(requestId: string, fullName: string): Promise<void> {
    // Только HRD, не Administrator — подтверждение из бота осталось HRD-эксклюзивной
    // фичей (Administrator подтверждает с web-панели, как и раньше).
    const recipients = (await userRepository.findByRoleAndChannel("HRD", "EMPLOYEE")).filter(
      (r) => r.telegramId !== null,
    );
    await Promise.all(
      recipients.map((r) =>
        notificationRepository.create({
          userId: r.id,
          channel: "TELEGRAM",
          payload: { type: "access_request_pending", requestId, fullName },
        }),
      ),
    );
  }

  /** @упоминание во "Внутренней работе" — точечно тому, кого тегнули, а не
   * широковещательно всем HRD/Admin (в отличие от createWebNotification-вызовов выше). */
  async notifyMentioned(appealId: string, fromFullName: string, userId: string, snippet: string): Promise<void> {
    const appeal = await appealRepository.findById(appealId);
    if (!appeal) return;
    await this.createWebNotification(
      userId,
      appealId,
      { type: "internal_mention", publicNumber: appeal.publicNumber, fromFullName, snippet },
      { title: "Вас упомянули", body: `${fromFullName}: ${snippet}` },
    );
  }

  async notifyAccessDecision(userId: string, approved: boolean): Promise<void> {
    await notificationRepository.create({
      userId,
      channel: "TELEGRAM",
      payload: { type: approved ? "access_approved" : "access_rejected" },
    });
  }

  unreadCountsByAppeal(userId: string, appealIds: string[]): Promise<Map<string, number>> {
    return notificationRepository.countPendingByAppeal(userId, appealIds);
  }

  markAppealRead(userId: string, appealId: string): Promise<void> {
    return notificationRepository.markAllReadForAppeal(userId, appealId).then(() => undefined);
  }

  pendingTypesForAppeal(userId: string, appealId: string): Promise<string[]> {
    return notificationRepository.listPendingTypesForAppeal(userId, appealId);
  }

  /**
   * botChannel (EMPLOYEE/CUSTOMER) — какой бот спрашивает, protocol — какой транспорт
   * уведомления (TELEGRAM/WEB). Раньше здесь фильтровался только protocol, а
   * botChannel не было вовсе — оба бота получали друг друга уведомления и молча
   * "съедали" (ack) чужие как no-op, см. комментарий у NotificationRepository.listPending.
   */
  listPendingForBot(botChannel: Channel, protocol: "TELEGRAM" | "WEB" = "TELEGRAM") {
    return notificationRepository.listPending(botChannel).then((items) =>
      items.filter((i) => i.channel === protocol),
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
