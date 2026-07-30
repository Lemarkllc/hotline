import type { AppealMode, CustomerAppealType } from "@hotline/shared";
import { CUSTOMER_APPEAL_TYPE_LABELS } from "@hotline/shared";
import { apiClient } from "../api.js";
import { GUIDED_QUESTIONS } from "../guidedQuestions.js";
import { MAIN_MENU_KEYBOARD, MODE_EXPLANATION, modeKeyboard, previewKeyboard, skipKeyboard, typeKeyboard } from "../keyboards.js";
import type { BotConversation } from "../types.js";
import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";

/** Фаза 7 (PLAN.md §6) — короче сотруднического: без вложений (см. appealService
 * "Канал CUSTOMER"), один мягкий наводящий вопрос вместо шести. */
export async function newAppeal(conversation: BotConversation, ctx: Context): Promise<void> {
  const telegramId = String(ctx.from!.id);

  async function pickType(): Promise<CustomerAppealType | "cancel"> {
    await ctx.reply("Вы хотите оставить жалобу или благодарность?", { reply_markup: typeKeyboard() });
    const answer = await conversation.waitForCallbackQuery(/^(type:|cancel)/);
    await answer.answerCallbackQuery();
    const data = answer.callbackQuery.data;
    if (data === "cancel") return "cancel";
    return data.split(":")[1] as CustomerAppealType;
  }

  async function pickMode(): Promise<AppealMode | "cancel"> {
    await ctx.reply(MODE_EXPLANATION, { reply_markup: modeKeyboard(), parse_mode: "Markdown" });
    const answer = await conversation.waitForCallbackQuery(/^(mode:|cancel)/);
    await answer.answerCallbackQuery();
    const data = answer.callbackQuery.data;
    if (data === "cancel") return "cancel";
    return data.split(":")[1] as AppealMode;
  }

  async function collectText(type: CustomerAppealType): Promise<string | "cancel"> {
    const [question] = GUIDED_QUESTIONS[type];
    await ctx.reply(question!, { reply_markup: skipKeyboard() });
    const firstAnswer = await conversation.waitFor(["message:text", "callback_query:data"]);
    const answers: string[] = [];
    if (firstAnswer.callbackQuery) {
      await firstAnswer.answerCallbackQuery(); // "Пропустить и написать своими словами"
    } else {
      answers.push(`${question}\n${firstAnswer.message!.text}`);
    }

    const closingText = answers.length
      ? "Если хотите что-то добавить своими словами — напишите. Если этого достаточно, сразу нажмите «Готово»."
      : "Опишите ситуацию своими словами одним или несколькими сообщениями. Когда закончите — нажмите «Готово».";

    const doneCancelKeyboard = new InlineKeyboard().text("Готово", "text_done").text("Отменить", "cancel");
    await ctx.reply(closingText, { reply_markup: doneCancelKeyboard });
    const freeform: string[] = [];
    for (;;) {
      const result = await conversation.waitFor(["message:text", "callback_query:data"]);
      if (result.callbackQuery) {
        await result.answerCallbackQuery();
        if (result.callbackQuery.data === "cancel") return "cancel";
        if (!answers.length && !freeform.length) {
          await ctx.reply("Опишите обращение хотя бы одним сообщением, прежде чем продолжить.");
          continue;
        }
        break; // text_done
      }
      freeform.push(result.message!.text);
      // Кнопки шлём заново под каждым сообщением — иначе они остаются наверху экрана
      // при длинном тексте в несколько сообщений (тот же фикс, что и у bot-employee).
      await ctx.reply("Принято. Ещё что-то — или нажмите «Готово».", { reply_markup: doneCancelKeyboard });
    }

    return [...answers, ...freeform].join("\n\n").trim();
  }

  let type = await pickType();
  if (type === "cancel") {
    await ctx.reply("Хорошо, ничего не отправляем.", { reply_markup: MAIN_MENU_KEYBOARD });
    return;
  }

  let mode = await pickMode();
  if (mode === "cancel") {
    await ctx.reply("Хорошо, ничего не отправляем.", { reply_markup: MAIN_MENU_KEYBOARD });
    return;
  }

  let originalText = await collectText(type);
  if (originalText === "cancel") {
    await ctx.reply("Хорошо, ничего не отправляем.", { reply_markup: MAIN_MENU_KEYBOARD });
    return;
  }

  for (;;) {
    await ctx.reply(
      `Тип: ${CUSTOMER_APPEAL_TYPE_LABELS[type]}\n` +
        `Режим: ${mode === "CONFIDENTIAL" ? "Конфиденциально" : "Открыто"}\n` +
        `Текст: ${originalText}\n\n` +
        "Проверьте перед отправкой.",
      { reply_markup: previewKeyboard() },
    );
    const answer = await conversation.waitForCallbackQuery(["submit", "edit_text", "edit_mode", "cancel"]);
    await answer.answerCallbackQuery();

    if (answer.callbackQuery.data === "cancel") {
      await ctx.reply("Хорошо, ничего не отправляем.", { reply_markup: MAIN_MENU_KEYBOARD });
      return;
    }
    if (answer.callbackQuery.data === "submit") break;
    if (answer.callbackQuery.data === "edit_text") {
      const result = await collectText(type);
      if (result === "cancel") {
        await ctx.reply("Хорошо, ничего не отправляем.", { reply_markup: MAIN_MENU_KEYBOARD });
        return;
      }
      originalText = result;
    }
    if (answer.callbackQuery.data === "edit_mode") {
      const result = await pickMode();
      if (result === "cancel") {
        await ctx.reply("Хорошо, ничего не отправляем.", { reply_markup: MAIN_MENU_KEYBOARD });
        return;
      }
      mode = result;
    }
  }

  const created = await conversation.external(() =>
    apiClient.createCustomerAppeal({ telegramId, type, mode, originalText }),
  );

  await ctx.reply(
    `Спасибо! Обращение зарегистрировано под номером ${created.publicNumber}.\n` +
      "Мы напишем, как только появятся новости.",
    { reply_markup: MAIN_MENU_KEYBOARD },
  );
}
