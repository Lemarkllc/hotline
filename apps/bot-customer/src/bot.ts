import { Bot, session } from "grammy";
import { sequentialize } from "@grammyjs/runner";
import { conversations, createConversation } from "@grammyjs/conversations";
import { ApiError, createRedisSessionStorage } from "@hotline/bot-core";
import { apiClient } from "./api.js";
import { config } from "./config.js";
import { consent } from "./conversations/consent.js";
import { newAppeal } from "./conversations/newAppeal.js";
import { MAIN_MENU_KEYBOARD, npsReturnKeyboard } from "./keyboards.js";
import { renderAppealDetail, renderMyAppealsMenu, renderMyAppealsPage } from "./myAppeals.js";
import { redis, SESSION_PREFIX } from "./redis.js";
import type { BotContext, SessionData } from "./types.js";

const WELCOME_TEXT =
  "Здравствуйте! Здесь можно оставить жалобу или благодарность о нашей компании.\n" +
  "Если выберете конфиденциальный режим, ваши данные не будут показаны широкому кругу сотрудников.";

const PRIVACY_TEXT =
  "Открытый режим: сотрудники, работающие с обращением, видят ваши данные.\n" +
  "Конфиденциальный режим: ваши данные скрыты, видны только ограниченному кругу ответственных.";

export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(config.telegramBotToken, { client: { timeoutSeconds: 30 } });

  const sessionKey = (ctx: BotContext) => ctx.chat?.id.toString();
  bot.use(sequentialize(sessionKey));

  bot.use(
    session<SessionData, BotContext>({
      initial: () => ({}),
      storage: createRedisSessionStorage(redis, SESSION_PREFIX),
    }),
  );

  bot.use(conversations());
  bot.use(createConversation(consent));
  bot.use(createConversation(newAppeal));

  async function handleStart(ctx: BotContext): Promise<void> {
    const telegramId = String(ctx.from!.id);
    try {
      const result = await apiClient.identifyExternalContact(telegramId);
      if (result.hasConsent) {
        await ctx.reply(WELCOME_TEXT, { reply_markup: MAIN_MENU_KEYBOARD });
        return;
      }
      // Контакт существует, но согласия нет — в норме не должно происходить (identify
      // создаёт контакт сразу с согласием, см. authService.externalContactIdentify),
      // но на всякий случай не оставляем пользователя в тупике.
      await ctx.conversation.enter("consent");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        await ctx.conversation.enter("consent");
        return;
      }
      throw error;
    }
  }

  /**
   * КРИТИЧНО (см. тот же баг у bot-employee этой сессией): проверка согласия должна
   * стоять перед КАЖДОЙ функциональной командой, не только /start. Без этого кто
   * угодно с любым telegramId мог бы создавать обращения, ни разу не согласившись
   * на обработку данных.
   */
  async function requireConsentedContact(ctx: BotContext): Promise<boolean> {
    const telegramId = String(ctx.from!.id);
    try {
      const result = await apiClient.identifyExternalContact(telegramId);
      if (result.hasConsent) return true;
      await ctx.reply("Сначала нужно пройти короткое согласие. Отправьте /start.");
      return false;
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        await ctx.reply("Сначала нужно пройти короткую регистрацию. Отправьте /start.");
        return false;
      }
      throw error;
    }
  }

  bot.command("start", handleStart);

  bot.command("new", async (ctx) => {
    if (!(await requireConsentedContact(ctx))) return;
    await ctx.conversation.enter("newAppeal");
  });
  bot.callbackQuery("menu:new", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!(await requireConsentedContact(ctx))) return;
    await ctx.conversation.enter("newAppeal");
  });

  bot.command("my", async (ctx) => {
    if (!(await requireConsentedContact(ctx))) return;
    await renderMyAppealsMenu(ctx);
  });
  bot.callbackQuery("menu:my", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!(await requireConsentedContact(ctx))) return;
    await renderMyAppealsMenu(ctx);
  });
  bot.callbackQuery(/^my_list:(OPEN|CLOSED):(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!(await requireConsentedContact(ctx))) return;
    await renderMyAppealsPage(ctx, ctx.match![1] as "OPEN" | "CLOSED", Number(ctx.match![2]));
  });
  bot.callbackQuery(/^my_page:(OPEN|CLOSED):(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!(await requireConsentedContact(ctx))) return;
    await renderMyAppealsPage(ctx, ctx.match![1] as "OPEN" | "CLOSED", Number(ctx.match![2]));
  });
  bot.callbackQuery(/^my_detail:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!(await requireConsentedContact(ctx))) return;
    await renderAppealDetail(ctx, ctx.match![1]!);
  });
  // "Написать сообщение" в карточке обращения — переиспользует тот же флаг сессии и
  // тот же bot.on("message:text") ниже, что и ответ на сообщение "Продаж" (sales_message
  // в notificationHandler.ts): разница только в том, кто начал переписку, доставка
  // (addExternalContactReply) одна и та же (см. аналогичный my_ask у bot-employee).
  bot.callbackQuery(/^my_ask:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!(await requireConsentedContact(ctx))) return;
    ctx.session.awaitingReplyForAppealId = ctx.match![1]!;
    await ctx.reply("Напишите сообщение следующим сообщением — я передам его в компанию.");
  });

  bot.command("privacy", async (ctx) => {
    if (!(await requireConsentedContact(ctx))) return;
    await ctx.reply(PRIVACY_TEXT);
  });
  bot.callbackQuery("menu:privacy", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!(await requireConsentedContact(ctx))) return;
    await ctx.reply(PRIVACY_TEXT);
  });

  bot.command("cancel", async (ctx) => {
    if (!(await requireConsentedContact(ctx))) return;
    await ctx.conversation.exitAll();
    await ctx.reply("Действие отменено.");
  });

  // Два NPS-вопроса подряд, стейтлесс через callback data (см. keyboards.ts) — второй
  // ответ несёт оба числа сразу, submit происходит только тут, не на первом шаге.
  bot.callbackQuery(/^nps_recommend:(.+):(\d)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!(await requireConsentedContact(ctx))) return;
    const appealId = ctx.match![1]!;
    const recommendScore = Number(ctx.match![2]);
    await ctx.reply("Обратитесь ли вы к нам снова?", {
      reply_markup: npsReturnKeyboard(appealId, recommendScore),
    });
  });
  bot.callbackQuery(/^nps_return:(.+):(\d):(\d)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!(await requireConsentedContact(ctx))) return;
    const appealId = ctx.match![1]!;
    const recommendScore = Number(ctx.match![2]);
    const returnScore = Number(ctx.match![3]);
    await apiClient.submitCustomerRating(String(ctx.from!.id), appealId, recommendScore, returnScore);
    await ctx.reply("Спасибо за оценку!");
  });
  bot.callbackQuery(/^nps_later:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("Хорошо, вы сможете оценить обращение позже через «Мои обращения».");
  });

  bot.on("message:text", async (ctx) => {
    const appealId = ctx.session.awaitingReplyForAppealId;
    if (appealId) {
      ctx.session.awaitingReplyForAppealId = undefined;
      await apiClient.replyToCustomerAppeal(String(ctx.from!.id), appealId, ctx.message.text);
      await ctx.reply("Сообщение передано.");
      return;
    }
    if (!(await requireConsentedContact(ctx))) return;
    await ctx.reply("Чтобы оставить обращение, используйте /new. Чтобы посмотреть свои — /my.");
  });

  bot.catch((err) => {
    console.error("Ошибка обработчика бота:", err.error);
  });

  return bot;
}
