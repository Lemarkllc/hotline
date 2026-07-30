import type { Bot } from "grammy";
import type { PendingNotification } from "@hotline/bot-core";
import { APPEAL_STATUS_LABELS, type AppealStatus } from "@hotline/shared";
import { npsRecommendKeyboard } from "./keyboards.js";
import type { BotContext } from "./types.js";

/** Транслирует запись из очереди уведомлений в сообщение Telegram — только
 * status_changed в этом заходе (нет флоу уточнений/упоминаний у клиента). Получатель
 * резолвится через externalContact.telegramId, не user.telegramId (Фаза 7, PLAN.md §6). */
export function createNotificationHandler(bot: Bot<BotContext>) {
  return async function handleNotification(notification: PendingNotification): Promise<void> {
    const telegramId = notification.externalContact?.telegramId;
    if (!telegramId) return; // WEB-уведомление роли «Продажи» сюда не долетает — фильтруется на API

    const payload = notification.payload as Record<string, unknown>;

    switch (payload.type) {
      case "status_changed": {
        const label = APPEAL_STATUS_LABELS[payload.toStatus as AppealStatus] ?? String(payload.toStatus);
        const finalAnswer = typeof payload.finalAnswer === "string" ? payload.finalAnswer : undefined;
        const text = finalAnswer
          ? `Статус обращения ${payload.publicNumber} изменён: ${label}.\n\nИтоговый ответ:\n${finalAnswer}`
          : `Статус обращения ${payload.publicNumber} изменён: ${label}.`;
        await bot.api.sendMessage(telegramId, text);
        if (payload.toStatus === "CLOSED" && notification.appealId) {
          await bot.api.sendMessage(telegramId, "Порекомендовали бы вы нас?", {
            reply_markup: npsRecommendKeyboard(notification.appealId),
          });
        }
        break;
      }
      default:
        break;
    }
  };
}
