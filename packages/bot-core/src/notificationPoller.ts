import type { ApiClient } from "./apiClient.js";

export type PendingNotification = Awaited<ReturnType<ApiClient["listPendingNotifications"]>>[number];

/**
 * Поллинг очереди уведомлений (TELEGRAM-канал) вместо push из API (архитектура §24:
 * BOT --> API, не наоборот). Каждое уведомление подтверждается (ack) только после
 * успешной отправки — при сбое Telegram оно останется PENDING и будет доставлено
 * повторно на следующем цикле (SRS §39.3: недоставленные уведомления — в повторную очередь).
 */
export function startNotificationPolling(
  apiClient: ApiClient,
  handler: (notification: PendingNotification) => Promise<void>,
  intervalMs = 5000,
): () => void {
  let stopped = false;

  async function tick() {
    if (stopped) return;
    try {
      const pending = await apiClient.listPendingNotifications();
      for (const notification of pending) {
        try {
          await handler(notification);
          await apiClient.ackNotification(notification.id);
        } catch {
          // не подтверждаем — попробуем ещё раз на следующем цикле
        }
      }
    } catch {
      // сетевой сбой — просто ждём следующего тика
    }
  }

  const timer = setInterval(() => void tick(), intervalMs);
  void tick();

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
