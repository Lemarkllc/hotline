import type { Bot } from "grammy";
import { patchSession } from "@hotline/bot-core";
import type { PendingNotification } from "@hotline/bot-core";
import { APPEAL_STATUS_LABELS, type AppealStatus } from "@hotline/shared";
import { npsRecommendKeyboard } from "./keyboards.js";
import { redis, SESSION_PREFIX } from "./redis.js";
import type { BotContext, SessionData } from "./types.js";

/** Транслирует запись из очереди уведомлений в сообщение Telegram — status_changed +
 * sales_message (переписка, Фаза 7). Получатель резолвится через
 * externalContact.telegramId, не user.telegramId (PLAN.md §6). */
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
      case "sales_message": {
        await bot.api.sendMessage(
          telegramId,
          `Сообщение по обращению ${payload.publicNumber}:\n${payload.text}\n\nОтветьте следующим сообщением.`,
        );
        if (notification.appealId) {
          await patchSession<SessionData>(redis, SESSION_PREFIX, telegramId, {
            awaitingReplyForAppealId: notification.appealId,
          });
        }
        break;
      }
      default:
        break;
    }
  };
}
