import type { Bot } from "grammy";
import { patchSession } from "@hotline/bot-core";
import type { PendingNotification } from "@hotline/bot-core";
import { APPEAL_STATUS_LABELS, type AppealStatus } from "@hotline/shared";
import { accessRequestKeyboard, ratingKeyboard } from "./keyboards.js";
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
        const finalAnswer = typeof payload.finalAnswer === "string" ? payload.finalAnswer : undefined;
        const text = finalAnswer
          ? `Статус обращения ${payload.publicNumber} изменён: ${label}.\n\nИтоговый ответ:\n${finalAnswer}`
          : `Статус обращения ${payload.publicNumber} изменён: ${label}.`;
        await bot.api.sendMessage(telegramId, text);
        // Проактивный запрос оценки (FR-EVL-001) — не ждём, пока автор сам зайдёт в
        // "Мои обращения"; там оценка тоже доступна как запасной путь, если пропустил это сообщение.
        if (payload.toStatus === "CLOSED" && notification.appealId) {
          await bot.api.sendMessage(
            telegramId,
            "Оцените, пожалуйста, насколько результат решил вопрос.",
            { reply_markup: ratingKeyboard(notification.appealId) },
          );
        }
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
      case "access_request_pending": {
        const fullName = typeof payload.fullName === "string" ? payload.fullName : "Сотрудник";
        const requestId = typeof payload.requestId === "string" ? payload.requestId : undefined;
        if (!requestId) break;
        await bot.api.sendMessage(
          telegramId,
          `Новая заявка на доступ к HotLineBot: ${fullName}.`,
          { reply_markup: accessRequestKeyboard(requestId) },
        );
        break;
      }
      default:
        break;
    }
  };
}
