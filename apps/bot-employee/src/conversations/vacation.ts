import type { Context } from "grammy";
import { apiClient } from "../api.js";
import { DATE_FORMAT_HINT, formatDate, parseDate } from "../dateInput.js";
import {
  attachmentsKeyboard,
  MAIN_MENU_KEYBOARD,
  vacationCommentKeyboard,
  vacationDateKeyboard,
  vacationPaidKeyboard,
  vacationPreviewKeyboard,
} from "../keyboards.js";
import type { BotConversation } from "../types.js";

/** Заявка на отпуск (VacationRequest, не Appeal) — согласовывает только HRD на вебе
 * (решение пользователя), поэтому здесь нет режима OPEN/CONFIDENTIAL — только тип
 * оплаты, даты, необязательный комментарий и обязательное фото заявления (прямое
 * решение пользователя, тот же приём, что и у RESIGNATION-обращений newAppeal.ts).
 * Анатомия — по образцу newAppeal.ts. Баланс/валидация против него — PLAN.md §10. */
export async function vacation(conversation: BotConversation, ctx: Context): Promise<void> {
  const telegramId = String(ctx.from!.id);

  async function cancelled(): Promise<void> {
    await ctx.reply("Заявка на отпуск отменена.", { reply_markup: MAIN_MENU_KEYBOARD });
  }

  async function pickPaid(): Promise<boolean | "cancel"> {
    await ctx.reply("Отпуск оплачиваемый или за свой счёт?", { reply_markup: vacationPaidKeyboard() });
    const answer = await conversation.waitForCallbackQuery(/^(paid:|cancel)/);
    await answer.answerCallbackQuery();
    if (answer.callbackQuery.data === "cancel") return "cancel";
    return answer.callbackQuery.data === "paid:true";
  }

  /** showBalanceButton — только при paid=true (за свой счёт баланс не проверяется,
   * кнопка была бы бессмысленной, PLAN.md §10). Кнопка «Узнать количество дней
   * отпуска» не прерывает шаг — после показа остатка тот же вопрос задаётся заново. */
  async function collectDate(prompt: string, showBalanceButton: boolean): Promise<Date | "cancel"> {
    await ctx.reply(prompt, { reply_markup: vacationDateKeyboard(showBalanceButton) });
    for (;;) {
      const result = await conversation.waitFor(["message:text", "callback_query:data"]);
      if (result.callbackQuery) {
        await result.answerCallbackQuery();
        if (result.callbackQuery.data === "cancel") return "cancel";
        if (result.callbackQuery.data === "check_balance") {
          const { availableDays } = await conversation.external(() => apiClient.getVacationBalance(telegramId));
          await ctx.reply(
            availableDays === null
              ? "Остаток отпуска пока не настроен в системе — уточните у HRD."
              : `Доступно дней отпуска: ${availableDays}.`,
          );
          await ctx.reply(prompt, { reply_markup: vacationDateKeyboard(showBalanceButton) });
          continue;
        }
        continue;
      }
      const parsed = parseDate(result.message!.text);
      if (!parsed) {
        await ctx.reply(`Не получилось распознать дату. Отправьте ${DATE_FORMAT_HINT}.`, {
          reply_markup: vacationDateKeyboard(showBalanceButton),
        });
        continue;
      }
      return parsed;
    }
  }

  /** Возвращает дату окончания не раньше dateFrom — переспрашивает, а не молча меняет местами. */
  async function collectDateTo(dateFrom: Date, showBalanceButton: boolean): Promise<Date | "cancel"> {
    for (;;) {
      const result = await collectDate(`Дата окончания отпуска (${DATE_FORMAT_HINT}):`, showBalanceButton);
      if (result === "cancel") return "cancel";
      if (result < dateFrom) {
        await ctx.reply("Дата окончания раньше даты начала — отправьте дату окончания ещё раз.");
        continue;
      }
      return result;
    }
  }

  async function collectComment(): Promise<string | undefined | "cancel"> {
    await ctx.reply("Комментарий (необязательно) — например, куда уезжаете или почему нужен отпуск именно сейчас.", {
      reply_markup: vacationCommentKeyboard(),
    });
    const result = await conversation.waitFor(["message:text", "callback_query:data"]);
    if (result.callbackQuery) {
      await result.answerCallbackQuery();
      if (result.callbackQuery.data === "cancel") return "cancel";
      return undefined; // skip_comment
    }
    return result.message!.text.trim() || undefined;
  }

  // Тот же приём, что collectAttachments в newAppeal.ts (requireAtLeastOne=true для
  // RESIGNATION) — приём фото вне conversation, через ctx.session.draftAttachmentIds
  // (см. bot.ts, известный баг @grammyjs/conversations на повторный external() в цикле).
  async function collectAttachments(): Promise<string[] | "cancel"> {
    await conversation.external((c) => {
      c.session.draftAttachmentIds = [];
    });
    await ctx.reply(
      "Прикрепите фото заявления на отпуск — отправьте его сюда файлом (через скрепку). " +
        "Когда закончите — нажмите «Перейти дальше».",
      { reply_markup: attachmentsKeyboard(0) },
    );
    for (;;) {
      const answer = await conversation.waitForCallbackQuery(["attach_done", "cancel"]);
      await answer.answerCallbackQuery();
      if (answer.callbackQuery.data === "cancel") {
        await conversation.external((c) => {
          c.session.draftAttachmentIds = undefined;
        });
        return "cancel";
      }
      const ids = await conversation.external((c) => c.session.draftAttachmentIds ?? []);
      if (ids.length === 0) {
        await ctx.reply("Нужно приложить хотя бы одно фото заявления, прежде чем продолжить.", {
          reply_markup: attachmentsKeyboard(0),
        });
        continue;
      }
      await conversation.external((c) => {
        c.session.draftAttachmentIds = undefined;
      });
      return ids;
    }
  }

  let paid = await pickPaid();
  if (paid === "cancel") return cancelled();

  let dateFrom = await collectDate(`Дата начала отпуска (${DATE_FORMAT_HINT}):`, paid);
  if (dateFrom === "cancel") return cancelled();

  let dateTo = await collectDateTo(dateFrom, paid);
  if (dateTo === "cancel") return cancelled();

  let comment = await collectComment();
  if (comment === "cancel") return cancelled();

  let attachmentIds = await collectAttachments();
  if (attachmentIds === "cancel") return cancelled();

  for (;;) {
    await ctx.reply(
      `Тип: ${paid ? "Оплачиваемый" : "За свой счёт"}\n` +
        `С ${formatDate(dateFrom)} по ${formatDate(dateTo)}` +
        (comment ? `\nКомментарий: ${comment}` : "") +
        `\nВложения: ${attachmentIds.length}` +
        "\n\nПроверьте данные перед отправкой.",
      { reply_markup: vacationPreviewKeyboard() },
    );
    const answer = await conversation.waitForCallbackQuery([
      "submit",
      "edit_paid",
      "edit_dates",
      "edit_comment",
      "edit_attachments",
      "cancel",
    ]);
    await answer.answerCallbackQuery();

    if (answer.callbackQuery.data === "cancel") return cancelled();
    if (answer.callbackQuery.data === "submit") break;
    if (answer.callbackQuery.data === "edit_paid") {
      const result = await pickPaid();
      if (result === "cancel") return cancelled();
      paid = result;
    }
    if (answer.callbackQuery.data === "edit_dates") {
      const newFrom = await collectDate(`Дата начала отпуска (${DATE_FORMAT_HINT}):`, paid);
      if (newFrom === "cancel") return cancelled();
      const newTo = await collectDateTo(newFrom, paid);
      if (newTo === "cancel") return cancelled();
      dateFrom = newFrom;
      dateTo = newTo;
    }
    if (answer.callbackQuery.data === "edit_comment") {
      const result = await collectComment();
      if (result === "cancel") return cancelled();
      comment = result;
    }
    if (answer.callbackQuery.data === "edit_attachments") {
      const result = await collectAttachments();
      if (result === "cancel") return cancelled();
      attachmentIds = result;
    }
  }

  try {
    const created = await conversation.external(() =>
      apiClient.createVacationRequest({ telegramId, dateFrom, dateTo, comment, paid, attachmentIds }),
    );
    await ctx.reply(
      `Заявка на отпуск зарегистрирована под номером ${created.publicNumber}.\n` +
        "Вы получите уведомление, когда HRD примет решение.",
      { reply_markup: MAIN_MENU_KEYBOARD },
    );
  } catch (error) {
    // Превышение баланса (paid=true) — единственная бизнес-валидация, которая может
    // прилететь с бэкенда на этом шаге (см. vacationService.createFromBot).
    const message = error instanceof Error ? error.message : "Не удалось создать заявку";
    await ctx.reply(`${message}\n\nПопробуйте изменить даты.`, { reply_markup: MAIN_MENU_KEYBOARD });
  }
}
