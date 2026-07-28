import type { AppealMode, EmployeeAppealType } from "@hotline/shared";
import { EMPLOYEE_APPEAL_TYPE_LABELS } from "@hotline/shared";
import { apiClient } from "../api.js";
import { GUIDED_QUESTIONS, URGENT_VIOLATION_WARNING } from "../guidedQuestions.js";
import {
  attachmentsKeyboard,
  MODE_EXPLANATION,
  modeKeyboard,
  previewKeyboard,
  skipAllKeyboard,
  typeKeyboard,
} from "../keyboards.js";
import { downloadTelegramMedia } from "../telegramFile.js";
import type { BotConversation } from "../types.js";
import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";

const MAX_ATTACHMENTS = 10;

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
    await ctx.reply(
      "Дальше — несколько наводящих вопросов, необязательных. Ответ на первый уже и есть " +
        "суть обращения, остальные просто помогают её дополнить.",
    );

    const answers: string[] = [];
    for (const question of GUIDED_QUESTIONS[type]) {
      await ctx.reply(question, { reply_markup: skipAllKeyboard() });
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

  async function collectAttachments(): Promise<string[] | "cancel"> {
    const attachmentIds: string[] = [];
    await ctx.reply(
      "Можно приложить до 10 фото или видео — просто отправьте их сюда файлом (через скрепку), " +
        "как обычное сообщение. Когда закончите — нажмите «Перейти дальше».",
      { reply_markup: attachmentsKeyboard(attachmentIds.length) },
    );
    for (;;) {
      const result = await conversation.waitFor([
        "message:photo",
        "message:video",
        "callback_query:data",
      ]);

      if (result.callbackQuery) {
        await result.answerCallbackQuery();
        const data = result.callbackQuery.data;
        if (data === "cancel") return "cancel";
        if (data === "attach_done") break;
        if (data === "attach_remove_last" && attachmentIds.length) {
          const last = attachmentIds.pop()!;
          await conversation.external(() => apiClient.removeDraftAttachment(telegramId, last));
          await ctx.reply(`Вложение удалено. Добавлено ${attachmentIds.length} из ${MAX_ATTACHMENTS} файлов.`, {
            reply_markup: attachmentsKeyboard(attachmentIds.length),
          });
        }
        continue;
      }

      if (attachmentIds.length >= MAX_ATTACHMENTS) {
        await ctx.reply(`Достигнут лимит ${MAX_ATTACHMENTS} файлов. Нажмите «Перейти дальше».`);
        continue;
      }

      try {
        const media = await conversation.external(() => downloadTelegramMedia(ctx.api, result.message!));
        if (!media) continue;
        const uploaded = await conversation.external(() =>
          apiClient.uploadDraftAttachment(telegramId, media.blob, media.filename),
        );
        attachmentIds.push(uploaded.id);
        await ctx.reply(`Добавлено ${attachmentIds.length} из ${MAX_ATTACHMENTS} файлов.`, {
          reply_markup: attachmentsKeyboard(attachmentIds.length),
        });
      } catch {
        // Сетевой сбой при скачивании из Telegram или загрузке в хранилище — не даём
        // диалогу тихо зависнуть, просим прислать файл ещё раз.
        await ctx.reply("Не удалось загрузить файл, попробуйте отправить его ещё раз.", {
          reply_markup: attachmentsKeyboard(attachmentIds.length),
        });
      }
    }
    return attachmentIds;
  }

  let type = await pickType();
  if (type === "cancel") {
    await ctx.reply("Создание обращения отменено.");
    return;
  }

  let mode = await pickMode();
  if (mode === "cancel") {
    await ctx.reply("Создание обращения отменено.");
    return;
  }

  let originalText = await collectText(type);
  if (originalText === "cancel") {
    await ctx.reply("Создание обращения отменено.");
    return;
  }

  let attachmentIds = await collectAttachments();
  if (attachmentIds === "cancel") {
    await ctx.reply("Создание обращения отменено.");
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
      await ctx.reply("Создание обращения отменено.");
      return;
    }
    if (answer.callbackQuery.data === "submit") break;
    if (answer.callbackQuery.data === "edit_text") {
      const result = await collectText(type);
      if (result === "cancel") {
        await ctx.reply("Создание обращения отменено.");
        return;
      }
      originalText = result;
    }
    if (answer.callbackQuery.data === "edit_mode") {
      const result = await pickMode();
      if (result === "cancel") {
        await ctx.reply("Создание обращения отменено.");
        return;
      }
      mode = result;
    }
    if (answer.callbackQuery.data === "edit_attachments") {
      const result = await collectAttachments();
      if (result === "cancel") {
        await ctx.reply("Создание обращения отменено.");
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
  );
}
