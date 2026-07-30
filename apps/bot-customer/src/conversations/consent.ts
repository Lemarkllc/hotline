import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { apiClient } from "../api.js";
import type { BotConversation } from "../types.js";

/**
 * Черновик — точный юридический текст вне зоны ответственности разработки (уже так
 * решено в PLAN.md §6), это плейсхолдер для проверки механики, не финальная формулировка.
 * CONSENT_VERSION — версия, на которую согласился клиент (ExternalContact.consentVersion);
 * меняйте при правке текста, чтобы отследить, кто на какую редакцию согласился.
 */
export const CONSENT_VERSION = "v1-draft";
const CONSENT_TEXT =
  "Прежде чем оставить обращение, нужно согласие на обработку персональных данных.\n\n" +
  "Мы используем ваше имя и текст обращения, чтобы разобраться в ситуации и связаться с вами " +
  "при необходимости. Вы можете оставить обращение конфиденциально — тогда ваши данные будут " +
  "видны только ограниченному кругу ответственных сотрудников.\n\n" +
  "(Черновик текста, финальная юридическая формулировка уточняется отдельно.)";

const confirmNameKeyboard = new InlineKeyboard()
  .text("Всё верно", "consent:confirm")
  .row()
  .text("Исправить", "consent:retry")
  .row()
  .text("Отменить", "consent:cancel");

const consentKeyboard = new InlineKeyboard()
  .text("Согласен, продолжить", "consent:accept")
  .row()
  .text("Отменить", "consent:cancel");

/** Онбординг клиента — аналог registration.ts у сотрудников, но без approval-флоу:
 * вместо ожидания подтверждения администратором единственный блокирующий шаг — явное
 * согласие (Фаза 7, PLAN.md §6). */
export async function consent(conversation: BotConversation, ctx: Context): Promise<void> {
  const telegramId = String(ctx.from!.id);

  let fullName = "";
  for (;;) {
    await ctx.reply("Здравствуйте! Как к вам обращаться? Введите имя.");
    const nameCtx = await conversation.waitFor("message:text");
    fullName = nameCtx.message.text.trim();

    await ctx.reply(`Проверьте: ${fullName}`, { reply_markup: confirmNameKeyboard });
    const answer = await conversation.waitForCallbackQuery(["consent:confirm", "consent:retry", "consent:cancel"]);
    await answer.answerCallbackQuery();
    if (answer.callbackQuery.data === "consent:cancel") {
      await ctx.reply("Хорошо, ничего не сохраняем. Чтобы начать заново, отправьте /start.");
      return;
    }
    if (answer.callbackQuery.data === "consent:confirm") break;
  }

  await ctx.reply(CONSENT_TEXT, { reply_markup: consentKeyboard });
  const consentAnswer = await conversation.waitForCallbackQuery(["consent:accept", "consent:cancel"]);
  await consentAnswer.answerCallbackQuery();
  if (consentAnswer.callbackQuery.data === "consent:cancel") {
    await ctx.reply("Хорошо, ничего не сохраняем. Чтобы начать заново, отправьте /start.");
    return;
  }

  await conversation.external(() => apiClient.identifyExternalContact(telegramId, fullName, CONSENT_VERSION));

  await ctx.reply("Спасибо! Теперь можно оставить обращение — /new, или посмотреть свои — /my.");
}
