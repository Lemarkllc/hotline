import webpush from "web-push";
import { config } from "@/config/unifiedConfig.js";
import { pushSubscriptionRepository } from "@/repositories/PushSubscriptionRepository.js";
import { logger } from "@/lib/logger.js";

if (config.webPush.vapidPublicKey && config.webPush.vapidPrivateKey) {
  webpush.setVapidDetails(
    config.webPush.vapidSubject,
    config.webPush.vapidPublicKey,
    config.webPush.vapidPrivateKey,
  );
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export class PushService {
  subscribe(userId: string, endpoint: string, p256dh: string, auth: string) {
    return pushSubscriptionRepository.upsert(userId, endpoint, p256dh, auth);
  }

  unsubscribe(endpoint: string) {
    return pushSubscriptionRepository.deleteByEndpoint(endpoint);
  }

  /** Best-effort — сбой пуша не должен ронять создание уведомления (SRS §18: доставка
   * пуш-браузером — дополнение к разделу "Уведомления", а не замена очереди). */
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    if (!config.webPush.vapidPublicKey || !config.webPush.vapidPrivateKey) return;
    const subscriptions = await pushSubscriptionRepository.listByUserId(userId);
    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify(payload),
          );
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            // Подписка больше не валидна (браузер отписался/очистил хранилище) — не ошибка.
            await pushSubscriptionRepository.deleteByEndpoint(sub.endpoint);
            return;
          }
          logger.error({ err: error, userId }, "Не удалось отправить web push");
        }
      }),
    );
  }
}

export const pushService = new PushService();
