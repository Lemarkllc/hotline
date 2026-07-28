import { Bot, session } from "grammy";
import { sequentialize } from "@grammyjs/runner";
import { conversations, createConversation } from "@grammyjs/conversations";
import { ApiError, createRedisSessionStorage } from "@hotline/bot-core";
import { apiClient } from "./api.js";
import { config } from "./config.js";
import { registration } from "./conversations/registration.js";
import { newAppeal } from "./conversations/newAppeal.js";
import { MAIN_MENU_KEYBOARD } from "./keyboards.js";
import { renderAppealDetail, renderMyAppealsPage } from "./myAppeals.js";
import { redis, SESSION_PREFIX } from "./redis.js";
import type { BotContext, SessionData } from "./types.js";

const WELCOME_TEXT =
  "Добро пожаловать в HotLineBot 👋\n" +
  "Здесь можно безопасно сообщить о проблеме, предложить улучшение, задать вопрос или выразить благодарность.\n" +
  "Если вы выберете конфиденциальный режим, ваши данные не будут показаны ответственным сотрудникам.";

const HELP_TEXT =
  "/new — создать обращение\n/my — мои обращения\n/privacy — о конфиденциальности\n/cancel — отменить текущее действие";

const PRIVACY_TEXT =
  "Открытый режим: HRD и назначенный менеджер видят ваши данные.\n" +
  "Конфиденциальный режим: ваши данные скрыты от менеджеров и видны только HRD, каждый такой просмотр " +
  "фиксируется в журнале аудита.";

export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(config.telegramBotToken);

  // grammy обрабатывает апдейты из одного getUpdates-батча конкурентно — если
  // пользователь шлёт две фотографии почти одновременно (Telegram-альбом),
  // оба апдейта одновременно читают и перезаписывают одну и ту же Redis-сессию,
  // теряя прогресс разговора (ровно баг "подгрузилась 1 фото из 2, дальше бот
  // завис"). sequentialize сериализует апдейты одного чата, не трогая остальных.
  const sessionKey = (ctx: BotContext) => ctx.chat?.id.toString();
  bot.use(sequentialize(sessionKey));

  bot.use(
    session<SessionData, BotContext>({
      initial: () => ({}),
      storage: createRedisSessionStorage(redis, SESSION_PREFIX),
    }),
  );
  bot.use(conversations());
  bot.use(createConversation(registration));
  bot.use(createConversation(newAppeal));

  async function handleStart(ctx: BotContext): Promise<void> {
    const telegramId = String(ctx.from!.id);
    try {
      const result = await apiClient.identifyTelegramUser(telegramId);
      switch (result.status) {
        case "ACTIVE":
          await ctx.reply(WELCOME_TEXT, { reply_markup: MAIN_MENU_KEYBOARD });
          break;
        case "PENDING":
          await ctx.reply("Ваша заявка на подтверждение всё ещё рассматривается администратором.");
          break;
        case "REJECTED":
          await ctx.reply("Ваша заявка была отклонена. За подробностями обратитесь к HRD.");
          break;
        case "BLOCKED":
          await ctx.reply("Ваш доступ заблокирован администратором.");
          break;
        default:
          await ctx.reply("Ваша учётная запись недоступна. Обратитесь к администратору.");
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        await ctx.conversation.enter("registration");
        return;
      }
      throw error;
    }
  }

  bot.command("start", handleStart);

  bot.command("new", (ctx) => ctx.conversation.enter("newAppeal"));
  bot.callbackQuery("menu:new", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("newAppeal");
  });

  bot.command("my", (ctx) => renderMyAppealsPage(ctx, 1));
  bot.callbackQuery("menu:my", async (ctx) => {
    await ctx.answerCallbackQuery();
    await renderMyAppealsPage(ctx, 1);
  });
  bot.callbackQuery(/^my_page:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await renderMyAppealsPage(ctx, Number(ctx.match![1]));
  });
  bot.callbackQuery(/^my_detail:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await renderAppealDetail(ctx, ctx.match![1]!);
  });

  bot.command("help", (ctx) => ctx.reply(HELP_TEXT));
  bot.callbackQuery("menu:help", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(HELP_TEXT);
  });

  bot.command("privacy", (ctx) => ctx.reply(PRIVACY_TEXT));
  bot.callbackQuery("menu:privacy", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(PRIVACY_TEXT);
  });

  bot.command("cancel", async (ctx) => {
    await ctx.conversation.exitAll();
    await ctx.reply("Действие отменено.");
  });

  bot.callbackQuery(/^rate:(.+):(\d)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const appealId = ctx.match![1]!;
    const scoreStr = ctx.match![2]!;
    await apiClient.submitRating(String(ctx.from!.id), appealId, Number(scoreStr));
    await ctx.reply("Спасибо за оценку!");
  });
  bot.callbackQuery(/^rate_later:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("Хорошо, вы сможете оценить обращение позже через «Мои обращения».");
  });

  // Ответ автора на уточнение HRD (SRS UC-007, §35.10). Флаг awaitingReplyForAppealId
  // выставляется доставкой уведомления типа hrd_message (см. notificationHandler.ts) —
  // напрямую в Redis-хранилище сессии, т.к. поллер уведомлений работает вне контекста апдейта.
  bot.on("message:text", async (ctx) => {
    const appealId = ctx.session.awaitingReplyForAppealId;
    if (appealId) {
      ctx.session.awaitingReplyForAppealId = undefined;
      await apiClient.replyToClarification(String(ctx.from!.id), appealId, ctx.message.text);
      await ctx.reply("Ответ передан HRD.");
      return;
    }
    await ctx.reply(
      "Чтобы создать обращение, используйте /new. Чтобы посмотреть свои обращения — /my.",
    );
  });

  bot.catch((err) => {
    console.error("Ошибка обработчика бота:", err.error);
  });

  return bot;
}
