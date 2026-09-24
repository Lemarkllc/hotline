import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { apiClient } from "../api.js";
import type { BotConversation } from "../types.js";
import { FULL_NAME_FORMAT_HINT, isValidFullName } from "../validators/fullName.js";

const PRIVACY_TEXT =
  "Перед регистрацией ознакомьтесь с правилами:\n\n" +
  "Нужно согласие на обработку персональных данных. Вы можете оставлять обращения " +
  "конфиденциально — в этом режиме ваши данные скрываются от ответственных сотрудников " +
  "и становятся видны только HRD.";

const confirmNameKeyboard = new InlineKeyboard()
  .text("Всё верно", "reg:confirm")
  .row()
  .text("Исправить", "reg:retry")
  .row()
  .text("Отменить", "reg:cancel");

const privacyKeyboard = new InlineKeyboard()
  .text("Согласен, продолжить", "reg:privacy_accept")
  .row()
  .text("Отменить", "reg:cancel");

/** SRS §5.1, §35.1 — flow регистрации нового сотрудника. */
export async function registration(conversation: BotConversation, ctx: Context): Promise<void> {
  const telegramId = String(ctx.from!.id);
  const chatId = ctx.chat!.id;
  const commandMenuScope = { type: "chat" as const, chat_id: chatId };

  // Реальный инцидент 2026-09-23/24: боковое меню команд (☰) остаётся доступным
  // даже пока бот ждёт текстовый ответ — несколько сотрудников тапнули пункт
  // «Получить VPN» именно в момент вопроса "Как вас зовут?", и "/vpn" улетело
  // боту как обычное текстовое сообщение, было принято за ФИО. На время
  // регистрации меню для этого конкретного чата пустое (per-chat scope, не
  // трогает глобальное меню для всех остальных); восстанавливаем в finally —
  // должно сработать и при отмене, и при ошибке, не только при успехе.
  await ctx.api.setMyCommands([], { scope: commandMenuScope });
  try {
    let fullName = "";
    for (;;) {
      await ctx.reply("Здравствуйте! HotLineBot — внутренний канал обратной связи. Как вас зовут? Введите ФИО.");
      const nameCtx = await conversation.waitFor("message:text");
      fullName = nameCtx.message.text.trim();

      if (!isValidFullName(fullName)) {
        await ctx.reply(FULL_NAME_FORMAT_HINT);
        continue;
      }

      await ctx.reply(`Проверьте данные: ${fullName}`, { reply_markup: confirmNameKeyboard });
      const answer = await conversation.waitForCallbackQuery(["reg:confirm", "reg:retry", "reg:cancel"]);
      await answer.answerCallbackQuery();
      if (answer.callbackQuery.data === "reg:cancel") {
        await ctx.reply("Регистрация отменена. Чтобы начать заново, отправьте /start.");
        return;
      }
      if (answer.callbackQuery.data === "reg:confirm") break;
      // reg:retry — повторяем цикл ввода ФИО
    }

    await ctx.reply(PRIVACY_TEXT, { reply_markup: privacyKeyboard });
    const privacyAnswer = await conversation.waitForCallbackQuery(["reg:privacy_accept", "reg:cancel"]);
    await privacyAnswer.answerCallbackQuery();
    if (privacyAnswer.callbackQuery.data === "reg:cancel") {
      await ctx.reply("Регистрация отменена. Чтобы начать заново, отправьте /start.");
      return;
    }

    await conversation.external(() => apiClient.identifyTelegramUser(telegramId, fullName));

    await ctx.reply(
      "Заявка на подтверждение отправлена администратору. Как только её рассмотрят, вы получите уведомление.\n\n" +
        "До подтверждения создание обращений недоступно. Статус заявки можно проверить командой /start.",
    );
  } finally {
    await ctx.api.deleteMyCommands({ scope: commandMenuScope });
  }
}
