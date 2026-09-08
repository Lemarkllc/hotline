import type { Bot } from "grammy";
import { patchSession } from "@hotline/bot-core";
import type { PendingNotification } from "@hotline/bot-core";
import { APPEAL_STATUS_LABELS, type AppealStatus } from "@hotline/shared";
import { config } from "./config.js";
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
      // «Отпуска» — решение принимается только на вебе (не в боте, в отличие от
      // access_request_pending выше), поэтому здесь просто текст-пинг без кнопок.
      case "vacation_request_pending": {
        const fullName = typeof payload.fullName === "string" ? payload.fullName : "Сотрудник";
        await bot.api.sendMessage(telegramId, `Новая заявка на отпуск: ${fullName}. Рассмотрите её в веб-панели.`);
        break;
      }
      case "vacation_approved": {
        // Только у отпуска — требование ТК РФ про письменное заявление (PLAN.md §10,
        // прямое решение пользователя: у "Отсутствия"/"Командировки" бумага не нужна).
        await bot.api.sendMessage(
          telegramId,
          "Ваш отпуск согласован, подойдите в отдел персонала — подписать документы.",
        );
        break;
      }
      case "vacation_rejected": {
        await bot.api.sendMessage(
          telegramId,
          "Ваш отпуск отклонён — уточните у вашего руководителя или директора по персоналу.",
        );
        break;
      }
      // Стадия «Оформление» (роль HR) — пинг без кнопок, тем же принципом, что
      // vacation_request_pending выше: решение/действие только на вебе.
      case "vacation_awaiting_processing": {
        const fullName = typeof payload.fullName === "string" ? payload.fullName : "Сотрудник";
        await bot.api.sendMessage(
          telegramId,
          `Отпуск согласован: ${fullName}. Ожидает оформления — посмотрите в веб-панели.`,
        );
        break;
      }
      case "vacation_processed": {
        await bot.api.sendMessage(telegramId, "Ваш отпуск оформлен.");
        break;
      }
      case "termination_awaiting_processing": {
        const fullName = typeof payload.fullName === "string" ? payload.fullName : "Сотрудник";
        await bot.api.sendMessage(
          telegramId,
          `Увольнение согласовано: ${fullName}. Ожидает оформления — посмотрите в веб-панели.`,
        );
        break;
      }
      case "termination_processed": {
        await bot.api.sendMessage(telegramId, "Процесс увольнения завершён. Всего доброго.");
        break;
      }
      case "absence_request_pending": {
        const fullName = typeof payload.fullName === "string" ? payload.fullName : "Сотрудник";
        await bot.api.sendMessage(telegramId, `Новая заявка на отсутствие: ${fullName}. Рассмотрите её в веб-панели.`);
        break;
      }
      case "absence_approved": {
        await bot.api.sendMessage(telegramId, "Ваша заявка на отсутствие одобрена HRD.");
        break;
      }
      case "absence_rejected": {
        await bot.api.sendMessage(telegramId, "Ваша заявка на отсутствие отклонена HRD.");
        break;
      }
      case "business_trip_request_pending": {
        const fullName = typeof payload.fullName === "string" ? payload.fullName : "Сотрудник";
        await bot.api.sendMessage(telegramId, `Новая заявка на командировку: ${fullName}. Рассмотрите её в веб-панели.`);
        break;
      }
      case "business_trip_approved": {
        await bot.api.sendMessage(telegramId, "Ваша заявка на командировку одобрена HRD.");
        break;
      }
      case "business_trip_rejected": {
        await bot.api.sendMessage(telegramId, "Ваша заявка на командировку отклонена HRD.");
        break;
      }
      case "employee_terminated": {
        // Best-effort: ошибка в одном чате (бот не добавлен/не админ) не должна
        // блокировать ack всего уведомления и уводить его в бесконечный ретрай раз
        // в 5с (см. packages/bot-core/notificationPoller.ts) — доступ к самому боту
        // уже перекрыт синхронно в userService.blockUser() ДО этого уведомления,
        // это лишь дополнительная, не критическая для безопасности зачистка чатов.
        const userId = Number(telegramId);
        for (const chatId of config.terminationRemovalChatIds) {
          try {
            await bot.api.banChatMember(chatId, userId);
            await bot.api.unbanChatMember(chatId, userId, { only_if_banned: true });
          } catch (error) {
            console.error(`Не удалось удалить ${telegramId} из чата ${chatId}:`, error);
          }
        }
        break;
      }
      default:
        break;
    }
  };
}
