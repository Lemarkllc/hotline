import { InlineKeyboard } from "grammy";
import type { Context } from "grammy";
import { apiClient } from "../api.js";
import { DATE_FORMAT_HINT, formatDate, parseDate } from "../dateInput.js";
import { absencePreviewKeyboard, absenceReasonKeyboard, absenceTimeKeyboard, MAIN_MENU_KEYBOARD } from "../keyboards.js";
import type { BotConversation } from "../types.js";

const CANCEL_KEYBOARD = new InlineKeyboard().text("Отменить", "cancel");
const TIME_FORMAT_HINT = "в формате ЧЧ:ММ-ЧЧ:ММ, например 09:00-13:00";

type TimeChoice = { from: string; to: string } | "full_day";

function parseTimeRange(text: string): { from: string; to: string } | null {
  const match = text.trim().match(/^([01]\d|2[0-3]):([0-5]\d)\s*-\s*([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  const from = `${match[1]}:${match[2]}`;
  const to = `${match[3]}:${match[4]}`;
  if (to <= from) return null;
  return { from, to };
}

function formatTime(time: TimeChoice): string {
  return time === "full_day" ? "Весь день" : `${time.from}–${time.to}`;
}

/** «Отсутствие» (AbsenceRequest, было TIME_OFF внутри Appeal — перенесено в раздел
 * «Отпуска» после разговора с HRD, PLAN.md §10). Структурированный сбор: дата → время
 * (диапазон или "Весь день") → необязательная причина. ФИО резолвится на бэкенде по
 * telegramId (как у всех заявок раздела), режим/конфиденциальности здесь нет вообще —
 * согласующий (HRD) обязан знать, кто отсутствует. Формальный workflow
 * PENDING→APPROVED/REJECTED (в отличие от прежнего статус-флоу обращений). */
export async function absence(conversation: BotConversation, ctx: Context): Promise<void> {
  const telegramId = String(ctx.from!.id);

  async function cancelled(): Promise<void> {
    await ctx.reply("Заявка на отсутствие отменена.", { reply_markup: MAIN_MENU_KEYBOARD });
  }

  async function collectDate(): Promise<Date | "cancel"> {
    await ctx.reply(`На какую дату (${DATE_FORMAT_HINT}):`, { reply_markup: CANCEL_KEYBOARD });
    for (;;) {
      const result = await conversation.waitFor(["message:text", "callback_query:data"]);
      if (result.callbackQuery) {
        await result.answerCallbackQuery();
        if (result.callbackQuery.data === "cancel") return "cancel";
        continue;
      }
      const parsed = parseDate(result.message!.text);
      if (!parsed) {
        await ctx.reply(`Не получилось распознать дату. Отправьте ${DATE_FORMAT_HINT}.`, {
          reply_markup: CANCEL_KEYBOARD,
        });
        continue;
      }
      return parsed;
    }
  }

  async function collectTime(): Promise<TimeChoice | "cancel"> {
    await ctx.reply(`На какое время — отправьте диапазон (${TIME_FORMAT_HINT}) или нажмите «Весь день».`, {
      reply_markup: absenceTimeKeyboard(),
    });
    for (;;) {
      const result = await conversation.waitFor(["message:text", "callback_query:data"]);
      if (result.callbackQuery) {
        await result.answerCallbackQuery();
        if (result.callbackQuery.data === "cancel") return "cancel";
        if (result.callbackQuery.data === "full_day") return "full_day";
        continue;
      }
      const parsed = parseTimeRange(result.message!.text);
      if (!parsed) {
        await ctx.reply(`Не получилось распознать время. Отправьте ${TIME_FORMAT_HINT}, или нажмите «Весь день».`, {
          reply_markup: absenceTimeKeyboard(),
        });
        continue;
      }
      return parsed;
    }
  }

  async function collectReason(): Promise<string | undefined | "cancel"> {
    await ctx.reply("Причина (необязательно):", { reply_markup: absenceReasonKeyboard() });
    const result = await conversation.waitFor(["message:text", "callback_query:data"]);
    if (result.callbackQuery) {
      await result.answerCallbackQuery();
      if (result.callbackQuery.data === "cancel") return "cancel";
      return undefined; // skip_reason
    }
    return result.message!.text.trim() || undefined;
  }

  let date = await collectDate();
  if (date === "cancel") return cancelled();

  let time = await collectTime();
  if (time === "cancel") return cancelled();

  let reason = await collectReason();
  if (reason === "cancel") return cancelled();

  for (;;) {
    await ctx.reply(
      `Дата: ${formatDate(date)}\nВремя: ${formatTime(time)}` +
        (reason ? `\nПричина: ${reason}` : "") +
        "\n\nПроверьте данные перед отправкой.",
      { reply_markup: absencePreviewKeyboard() },
    );
    const answer = await conversation.waitForCallbackQuery([
      "submit",
      "edit_date",
      "edit_time",
      "edit_reason",
      "cancel",
    ]);
    await answer.answerCallbackQuery();

    if (answer.callbackQuery.data === "cancel") return cancelled();
    if (answer.callbackQuery.data === "submit") break;
    if (answer.callbackQuery.data === "edit_date") {
      const result = await collectDate();
      if (result === "cancel") return cancelled();
      date = result;
    }
    if (answer.callbackQuery.data === "edit_time") {
      const result = await collectTime();
      if (result === "cancel") return cancelled();
      time = result;
    }
    if (answer.callbackQuery.data === "edit_reason") {
      const result = await collectReason();
      if (result === "cancel") return cancelled();
      reason = result;
    }
  }

  const fullDay = time === "full_day";
  const created = await conversation.external(() =>
    apiClient.createAbsenceRequest({
      telegramId,
      date,
      fullDay,
      timeFrom: time === "full_day" ? undefined : time.from,
      timeTo: time === "full_day" ? undefined : time.to,
      reason,
    }),
  );

  await ctx.reply(
    `Заявка на отсутствие зарегистрирована под номером ${created.publicNumber}.\n` +
      "Вы получите уведомление, когда HRD примет решение.",
    { reply_markup: MAIN_MENU_KEYBOARD },
  );
}
