import type { Bot } from "grammy";
import { patchSession } from "@hotline/bot-core";
import type { PendingNotification } from "@hotline/bot-core";
import { APPEAL_STATUS_LABELS, type AppealStatus } from "@hotline/shared";
import { config } from "./config.js";
import { accessRequestKeyboard, confirmDataKeyboard, ratingKeyboard } from "./keyboards.js";
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
      case "confirm_data_request": {
        // Со сроком и автоблокировкой (решение 2026-10-02): «Данные верны» — кнопкой,
        // исправленное ФИО — следующим сообщением (session.awaitingFullNameCorrection).
        await bot.api.sendMessage(
          telegramId,
          "Подтвердите ваши данные в течение 2 дней, во избежание блокировки в системе.\n\n" +
            `Ваше ФИО в системе: ${payload.fullName}\n` +
            `Срок: до ${formatDeadline(payload.deadline)} (МСК)\n\n` +
            "Если всё верно — нажмите «Данные верны». Если нет — пришлите правильные Фамилию, Имя и Отчество " +
            "одним сообщением, данные обновятся автоматически.",
          { reply_markup: confirmDataKeyboard() },
        );
        await patchSession<SessionData>(redis, SESSION_PREFIX, telegramId, {
          awaitingFullNameCorrection: true,
        });
        break;
      }
      case "confirm_data_reminder": {
        await bot.api.sendMessage(
          telegramId,
          `Напоминание: подтвердите ваши данные до ${formatDeadline(payload.deadline)} (МСК), иначе доступ ` +
            "в системе будет заблокирован.\n\n" +
            `Ваше ФИО в системе: ${payload.fullName}\n\n` +
            "Если всё верно — нажмите «Данные верны». Если нет — пришлите правильные ФИО одним сообщением.",
          { reply_markup: confirmDataKeyboard() },
        );
        await patchSession<SessionData>(redis, SESSION_PREFIX, telegramId, {
          awaitingFullNameCorrection: true,
        });
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
        const reason = typeof payload.reason === "string" ? payload.reason : undefined;
        const permanent = payload.permanent === true;
        const reasonText = reason ? `\n\nПричина: ${reason}` : "";
        const retryText = permanent
          ? ""
          : "\n\nМожно подать заявку заново — отправьте /start и укажите корректные данные.";
        await bot.api.sendMessage(telegramId, `Ваша заявка отклонена администратором.${reasonText}${retryText}`);
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
        // Приглашение "подойдите в отдел персонала" раньше уходило прямо здесь, сразу
        // при апруве HRD — теперь отдельное ручное действие HR, кнопка «Пригласить»
        // (по требованию пользователя, 2026-09-15, см. vacation_invite ниже).
        await bot.api.sendMessage(telegramId, "Ваш отпуск согласован.");
        break;
      }
      case "vacation_invite": {
        await bot.api.sendMessage(telegramId, "Подойдите в отдел персонала — подписать документы.");
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
      case "termination_invite": {
        await bot.api.sendMessage(telegramId, "Подойдите в отдел кадров — оформить документы.");
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
        await removeFromWorkChats(bot, telegramId);
        break;
      }
      case "user_blocked_data_unconfirmed": {
        // Блокировка по сроку «Подтвердить данные» — те же действия, что при ручной
        // (userService.blockUser), но сотруднику сообщается настоящая причина.
        try {
          await bot.api.sendMessage(
            telegramId,
            "Ваш доступ в системе заблокирован: данные не были подтверждены в течение 2 дней. " +
              "Чтобы восстановить доступ, обратитесь в отдел персонала.",
          );
        } catch (error) {
          console.error(`Не удалось сообщить ${telegramId} о блокировке:`, error);
        }
        await removeFromWorkChats(bot, telegramId);
        break;
      }
      default:
        break;
    }
  };
}

/** Удаление из рабочих чатов при блокировке. Best-effort: ошибка в одном чате (бот не
 * добавлен/не админ) не должна блокировать ack всего уведомления и уводить его в
 * бесконечный ретрай раз в 5с (см. packages/bot-core/notificationPoller.ts) — доступ к
 * самому боту уже перекрыт синхронно в userService.blockUser() ДО этого уведомления,
 * это лишь дополнительная, не критическая для безопасности зачистка чатов. */
async function removeFromWorkChats(bot: Bot<BotContext>, telegramId: string | number): Promise<void> {
  const userId = Number(telegramId);
  for (const chatId of config.terminationRemovalChatIds) {
    try {
      await bot.api.banChatMember(chatId, userId);
      await bot.api.unbanChatMember(chatId, userId, { only_if_banned: true });
    } catch (error) {
      console.error(`Не удалось удалить ${telegramId} из чата ${chatId}:`, error);
    }
  }
}

function formatDeadline(iso: unknown): string {
  return new Date(String(iso)).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  });
}
