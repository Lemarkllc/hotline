import type { AppealMode, EmployeeAppealType } from "@hotline/shared";
import { EMPLOYEE_APPEAL_TYPE_LABELS } from "@hotline/shared";
import { apiClient } from "../api.js";
import { GUIDED_QUESTIONS, URGENT_VIOLATION_WARNING } from "../guidedQuestions.js";
import {
  attachmentsKeyboard,
  MAIN_MENU_KEYBOARD,
  MODE_EXPLANATION,
  modeKeyboard,
  previewKeyboard,
  skipAllKeyboard,
  typeKeyboard,
} from "../keyboards.js";
import type { BotConversation } from "../types.js";
import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";

/** SRS §9, §35.4-35.8 — пошаговое создание обращения с предпросмотром и редактированием. */
export async function newAppeal(conversation: BotConversation, ctx: Context): Promise<void> {
  const telegramId = String(ctx.from!.id);

  async function pickType(): Promise<EmployeeAppealType | "cancel"> {
    await ctx.reply("Выберите тип обращения:", { reply_markup: typeKeyboard() });
    const answer = await conversation.waitForCallbackQuery(/^(type:|cancel)/);
    await answer.answerCallbackQuery();
    const data = answer.callbackQuery.data;
    if (data === "cancel") return "cancel";
    const type = data.split(":")[1] as EmployeeAppealType;
    if (type === "VIOLATION") {
      await ctx.reply(URGENT_VIOLATION_WARNING);
    }
    return type;
  }

  async function pickMode(): Promise<AppealMode | "cancel"> {
    await ctx.reply(MODE_EXPLANATION, { reply_markup: modeKeyboard(), parse_mode: "Markdown" });
    const answer = await conversation.waitForCallbackQuery(/^(mode:|cancel)/);
    await answer.answerCallbackQuery();
    const data = answer.callbackQuery.data;
    if (data === "cancel") return "cancel";
    return data.split(":")[1] as AppealMode;
  }

  async function collectText(type: EmployeeAppealType): Promise<string | "cancel"> {
    // Кнопка пропуска висит один раз на вводном сообщении, а не на каждом вопросе —
    // иначе выглядит так, будто кнопка это вариант ответа на конкретный вопрос, а не
    // общий пропуск всех вопросов сразу (путало пользователя).
    await ctx.reply(
      "Дальше — несколько наводящих вопросов, необязательных. Ответ на первый уже и есть " +
        "суть обращения, остальные просто помогают её дополнить.",
      { reply_markup: skipAllKeyboard() },
    );

    const answers: string[] = [];
    for (const question of GUIDED_QUESTIONS[type]) {
      await ctx.reply(question);
      const result = await conversation.waitFor(["message:text", "callback_query:data"]);
      if (result.callbackQuery) {
        await result.answerCallbackQuery();
        break; // "Пропустить и написать своими словами"
      }
      answers.push(`${question}\n${result.message!.text}`);
    }

    // Если уже что-то ответили — вопросы формируют описание, дальше только
    // опционально дополнить. Если пропустили всё — текст обязателен (FR-APP-004).
    const closingText = answers.length
      ? "Если хотите что-то добавить своими словами — напишите. Если ответов выше достаточно, " +
        "сразу нажмите «Готово»."
      : "Опишите ситуацию своими словами одним или несколькими сообщениями. Когда закончите — нажмите «Готово».";

    await ctx.reply(closingText, {
      reply_markup: new InlineKeyboard().text("Готово", "text_done").text("Отменить", "cancel"),
    });
    const freeform: string[] = [];
    for (;;) {
      const result = await conversation.waitFor(["message:text", "callback_query:data"]);
      if (result.callbackQuery) {
        await result.answerCallbackQuery();
        if (result.callbackQuery.data === "cancel") return "cancel";
        // Текст обязателен (FR-APP-004) — нельзя нажать «Готово», не ответив ни на один
        // наводящий вопрос и не написав ничего своими словами.
        if (!answers.length && !freeform.length) {
          await ctx.reply("Опишите обращение хотя бы одним сообщением, прежде чем продолжить.");
          continue;
        }
        break; // text_done
      }
      freeform.push(result.message!.text);
    }

    return [...answers, ...freeform].join("\n\n").trim();
  }

  // Приём самих фото/видео живёт вне conversation — обычными хендлерами в bot.ts,
  // читающими/пишущими ctx.session.draftAttachmentIds напрямую. Причина: повторный
  // conversation.external() внутри цикла на КАЖДОЕ вложение — известное больное место
  // @grammyjs/conversations (https://github.com/grammyjs/conversations/issues/32),
  // намертво вешающее механизм повтора разговора после второго файла. Здесь конверсация
  // только включает/выключает режим сбора и ждёт финальную кнопку.
  async function collectAttachments(): Promise<string[] | "cancel"> {
    await conversation.external((c) => {
      c.session.draftAttachmentIds = [];
    });
    await ctx.reply(
      "Можно приложить до 10 фото или видео — просто отправьте их сюда файлом (через скрепку), " +
        "как обычное сообщение. Когда закончите — нажмите «Перейти дальше».",
      { reply_markup: attachmentsKeyboard(0) },
    );
    const answer = await conversation.waitForCallbackQuery(["attach_done", "cancel"]);
    await answer.answerCallbackQuery();
    const ids = await conversation.external((c) => {
      const result = c.session.draftAttachmentIds ?? [];
      c.session.draftAttachmentIds = undefined;
      return result;
    });
    return answer.callbackQuery.data === "cancel" ? "cancel" : ids;
  }

  let type = await pickType();
  if (type === "cancel") {
    await ctx.reply("Создание обращения отменено.", { reply_markup: MAIN_MENU_KEYBOARD });
    return;
  }

  let mode = await pickMode();
  if (mode === "cancel") {
    await ctx.reply("Создание обращения отменено.", { reply_markup: MAIN_MENU_KEYBOARD });
    return;
  }

  let originalText = await collectText(type);
  if (originalText === "cancel") {
    await ctx.reply("Создание обращения отменено.", { reply_markup: MAIN_MENU_KEYBOARD });
    return;
  }

  let attachmentIds = await collectAttachments();
  if (attachmentIds === "cancel") {
    await ctx.reply("Создание обращения отменено.", { reply_markup: MAIN_MENU_KEYBOARD });
    return;
  }

  for (;;) {
    await ctx.reply(
      `Тип: ${EMPLOYEE_APPEAL_TYPE_LABELS[type]}\n` +
        `Режим: ${mode === "CONFIDENTIAL" ? "Конфиденциально" : "Открыто"}\n` +
        `Текст: ${originalText}\n` +
        `Вложения: ${attachmentIds.length}\n\n` +
        "Проверьте данные перед отправкой.",
      { reply_markup: previewKeyboard() },
    );
    const answer = await conversation.waitForCallbackQuery([
      "submit",
      "edit_text",
      "edit_mode",
      "edit_attachments",
      "cancel",
    ]);
    await answer.answerCallbackQuery();

    if (answer.callbackQuery.data === "cancel") {
      await ctx.reply("Создание обращения отменено.", { reply_markup: MAIN_MENU_KEYBOARD });
      return;
    }
    if (answer.callbackQuery.data === "submit") break;
    if (answer.callbackQuery.data === "edit_text") {
      const result = await collectText(type);
      if (result === "cancel") {
        await ctx.reply("Создание обращения отменено.", { reply_markup: MAIN_MENU_KEYBOARD });
        return;
      }
      originalText = result;
    }
    if (answer.callbackQuery.data === "edit_mode") {
      const result = await pickMode();
      if (result === "cancel") {
        await ctx.reply("Создание обращения отменено.", { reply_markup: MAIN_MENU_KEYBOARD });
        return;
      }
      mode = result;
    }
    if (answer.callbackQuery.data === "edit_attachments") {
      const result = await collectAttachments();
      if (result === "cancel") {
        await ctx.reply("Создание обращения отменено.", { reply_markup: MAIN_MENU_KEYBOARD });
        return;
      }
      attachmentIds = result;
    }
  }

  const created = await conversation.external(() =>
    apiClient.createAppeal({ telegramId, type, mode, originalText, attachmentIds }),
  );

  await ctx.reply(
    `Обращение зарегистрировано под номером ${created.publicNumber}.\n` +
      "Вы получите уведомление, когда появятся новости.",
    { reply_markup: MAIN_MENU_KEYBOARD },
  );
}
