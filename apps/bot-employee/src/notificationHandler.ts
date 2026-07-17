import type { Bot } from "grammy";
import { patchSession } from "@hotline/bot-core";
import type { PendingNotification } from "@hotline/bot-core";
import { APPEAL_STATUS_LABELS, type AppealStatus } from "@hotline/shared";
import { redis, SESSION_PREFIX } from "./redis.js";
import type { BotContext, SessionData } from "./types.js";

/** Транслирует запись из очереди уведомлений (SRS §18) в сообщение Telegram-боту. */
export function createNotificationHandler(bot: Bot<BotContext>) {
  return async function handleNotification(notification: PendingNotification): Promise<void> {
    const telegramId = notification.user?.telegramId;
    if (!telegramId) return; // WEB-канал (HRD/менеджер) сюда не долетает — фильтруется на API

    const payload = notification.payload as Record<string, unknown>;

    switch (payload.type) {
      case "status_changed": {
        const label = APPEAL_STATUS_LABELS[payload.toStatus as AppealStatus] ?? String(payload.toStatus);
        await bot.api.sendMessage(telegramId, `Статус обращения ${payload.publicNumber} изменён: ${label}.`);
        break;
      }
      case "hrd_message": {
        await bot.api.sendMessage(
          telegramId,
          `Уточнение по обращению ${payload.publicNumber}:\n${payload.text}\n\nОтветьте следующим сообщением.`,
        );
        if (notification.appealId) {
          await patchSession<SessionData>(redis, SESSION_PREFIX, telegramId, {
            awaitingReplyForAppealId: notification.appealId,
          });
        }
        break;
      }
      case "access_approved": {
        await bot.api.sendMessage(
          telegramId,
          "Ваша заявка подтверждена администратором. Добро пожаловать! Отправьте /start, чтобы начать.",
        );
        break;
      }
      case "access_rejected": {
        await bot.api.sendMessage(telegramId, "Ваша заявка отклонена администратором.");
        break;
      }
      default:
        break;
    }
  };
}
