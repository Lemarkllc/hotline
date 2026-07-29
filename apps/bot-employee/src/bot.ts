import { Bot, session } from "grammy";
import { sequentialize } from "@grammyjs/runner";
import { conversations, createConversation } from "@grammyjs/conversations";
import { ApiError, createRedisSessionStorage } from "@hotline/bot-core";
import { apiClient } from "./api.js";
import { config } from "./config.js";
import { registration } from "./conversations/registration.js";
import { newAppeal } from "./conversations/newAppeal.js";
import { attachmentsKeyboard, MAIN_MENU_KEYBOARD, MAX_ATTACHMENTS } from "./keyboards.js";
import { renderAppealDetail, renderMyAppealsMenu, renderMyAppealsPage } from "./myAppeals.js";
import { redis, SESSION_PREFIX } from "./redis.js";
import { downloadTelegramMedia } from "./telegramFile.js";
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

const NON_ACTIVE_STATUS_MESSAGES: Record<string, string> = {
  PENDING: "Ваша заявка на подтверждение всё ещё рассматривается администратором.",
  REJECTED: "Ваша заявка была отклонена. За подробностями обратитесь к HRD.",
  BLOCKED: "Ваш доступ заблокирован администратором.",
};

export function createBot(): Bot<BotContext> {
  // grammy сам по себе не ставит таймаут исходящим вызовам Bot API (ctx.reply,
  // answerCallbackQuery, getFile...) — зависший вызов вешает разговор навсегда без
  // единой ошибки в логах (ровно баг "бот завис после фото"/"после Перейти дальше").
  const bot = new Bot<BotContext>(config.telegramBotToken, { client: { timeoutSeconds: 30 } });

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

  // Приём фото/видео при сборе вложений обрабатывается ЗДЕСЬ, обычными хендлерами,
  // а не через conversation.waitFor()+external() внутри newAppeal — у @grammyjs/conversations
  // известная проблема с повторным external() в цикле, намертво вешающая механизм повтора
  // разговора (https://github.com/grammyjs/conversations/issues/32; ровно баг "бот виснет
  // после второго фото"). Регистрируются ДО conversations()/createConversation(newAppeal),
  // чтобы конверсация (не parallel) не успела молча проглотить апдейт как несовпавший.
  // Присутствие ctx.session.draftAttachmentIds — сигнал "сейчас идёт сбор вложений",
  // выставляется/снимается самой newAppeal через conversation.external().
  bot.on(["message:photo", "message:video"], async (ctx, next) => {
    if (!ctx.session.draftAttachmentIds) {
      await next();
      return;
    }
    const ids = ctx.session.draftAttachmentIds;
    if (ids.length >= MAX_ATTACHMENTS) {
      await ctx.reply(`Достигнут лимит ${MAX_ATTACHMENTS} файлов. Нажмите «Перейти дальше».`);
      return;
    }
    const telegramId = String(ctx.from!.id);
    try {
      const media = await downloadTelegramMedia(ctx.api, ctx.message);
      if (!media) return;
      const uploaded = await apiClient.uploadDraftAttachment(telegramId, media.blob, media.filename);
      ids.push(uploaded.id);
      await ctx.reply(`Добавлено ${ids.length} из ${MAX_ATTACHMENTS} файлов.`, {
        reply_markup: attachmentsKeyboard(ids.length),
      });
    } catch {
      await ctx.reply("Не удалось загрузить файл, попробуйте отправить его ещё раз.", {
        reply_markup: attachmentsKeyboard(ids.length),
      });
    }
  });

  bot.callbackQuery("attach_remove_last", async (ctx) => {
    await ctx.answerCallbackQuery();
    const ids = ctx.session.draftAttachmentIds;
    if (!ids?.length) return;
    const last = ids.pop()!;
    await apiClient.removeDraftAttachment(String(ctx.from!.id), last);
    await ctx.reply(`Вложение удалено. Добавлено ${ids.length} из ${MAX_ATTACHMENTS} файлов.`, {
      reply_markup: attachmentsKeyboard(ids.length),
    });
  });

  bot.use(conversations());
  bot.use(createConversation(registration));
  bot.use(createConversation(newAppeal));

  async function handleStart(ctx: BotContext): Promise<void> {
    const telegramId = String(ctx.from!.id);
    try {
      const result = await apiClient.identifyTelegramUser(telegramId);
      if (result.status === "ACTIVE") {
        await ctx.reply(WELCOME_TEXT, { reply_markup: MAIN_MENU_KEYBOARD });
        return;
      }
      await ctx.reply(
        NON_ACTIVE_STATUS_MESSAGES[result.status] ?? "Ваша учётная запись недоступна. Обратитесь к администратору.",
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        await ctx.conversation.enter("registration");
        return;
      }
      throw error;
    }
  }

  /**
   * КРИТИЧНО: единственная точка проверки "пользователь подтверждён" перед ЛЮБЫМ
   * функциональным действием, кроме /start. Раньше статус сверял только /start —
   * /new, /my, /help, /privacy и все колбэки меню (menu:…, my_…) выполнялись у кого угодно
   * с любым telegramId, включая ещё не подтверждённых (PENDING) и заблокированных
   * (BLOCKED/REJECTED). Возвращает false и сам отвечает пользователю, если доступа
   * нет — вызывающий код должен в этом случае просто return'иться, ничего не делая.
   */
  async function requireActiveUser(ctx: BotContext): Promise<boolean> {
    const telegramId = String(ctx.from!.id);
    try {
      const result = await apiClient.identifyTelegramUser(telegramId);
      if (result.status === "ACTIVE") return true;
      await ctx.reply(
        NON_ACTIVE_STATUS_MESSAGES[result.status] ?? "Ваша учётная запись недоступна. Обратитесь к администратору.",
      );
      return false;
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        await ctx.reply("Вы ещё не зарегистрированы. Отправьте /start, чтобы начать регистрацию.");
        return false;
      }
      throw error;
    }
  }

  bot.command("start", handleStart);

  bot.command("new", async (ctx) => {
    if (!(await requireActiveUser(ctx))) return;
    await ctx.conversation.enter("newAppeal");
  });
  bot.callbackQuery("menu:new", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!(await requireActiveUser(ctx))) return;
    await ctx.conversation.enter("newAppeal");
  });

  bot.command("my", async (ctx) => {
    if (!(await requireActiveUser(ctx))) return;
    await renderMyAppealsMenu(ctx);
  });
  bot.callbackQuery("menu:my", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!(await requireActiveUser(ctx))) return;
    await renderMyAppealsMenu(ctx);
  });
  bot.callbackQuery(/^my_list:(OPEN|CLOSED):(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!(await requireActiveUser(ctx))) return;
    await renderMyAppealsPage(ctx, ctx.match![1] as "OPEN" | "CLOSED", Number(ctx.match![2]));
  });
  bot.callbackQuery(/^my_page:(OPEN|CLOSED):(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!(await requireActiveUser(ctx))) return;
    await renderMyAppealsPage(ctx, ctx.match![1] as "OPEN" | "CLOSED", Number(ctx.match![2]));
  });
  bot.callbackQuery(/^my_detail:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!(await requireActiveUser(ctx))) return;
    await renderAppealDetail(ctx, ctx.match![1]!);
  });
  // "Задать вопрос по обращению" — переиспользует тот же флаг сессии и тот же
  // bot.on("message:text") ниже, что и ответ на уточнение от HRD: разница только
  // в том, кто инициировал переписку, сама доставка (addAuthorReply) одна и та же.
  bot.callbackQuery(/^my_ask:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!(await requireActiveUser(ctx))) return;
    ctx.session.awaitingReplyForAppealId = ctx.match![1]!;
    await ctx.reply("Напишите ваш вопрос следующим сообщением — я передам его HRD.");
  });

  bot.command("help", async (ctx) => {
    if (!(await requireActiveUser(ctx))) return;
    await ctx.reply(HELP_TEXT);
  });
  bot.callbackQuery("menu:help", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!(await requireActiveUser(ctx))) return;
    await ctx.reply(HELP_TEXT);
  });

  bot.command("privacy", async (ctx) => {
    if (!(await requireActiveUser(ctx))) return;
    await ctx.reply(PRIVACY_TEXT);
  });
  bot.callbackQuery("menu:privacy", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!(await requireActiveUser(ctx))) return;
    await ctx.reply(PRIVACY_TEXT);
  });

  bot.command("cancel", async (ctx) => {
    if (!(await requireActiveUser(ctx))) return;
    await ctx.conversation.exitAll();
    await ctx.reply("Действие отменено.");
  });

  // Подтверждение/отклонение заявок на доступ HRD'ом прямо из push-уведомления
  // (дополнение к FR-USR-003, роль перепроверяется на бэкенде — см. userService.requireHrdActor).
  bot.callbackQuery(/^accreq_approve:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    try {
      await apiClient.decideAccessRequest(String(ctx.from!.id), ctx.match![1]!, "approve");
      await ctx.reply("Заявка подтверждена.");
    } catch {
      await ctx.reply("Не удалось подтвердить заявку — нет прав HRD или заявка уже обработана.");
    }
  });
  bot.callbackQuery(/^accreq_reject:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    try {
      await apiClient.decideAccessRequest(String(ctx.from!.id), ctx.match![1]!, "reject");
      await ctx.reply("Заявка отклонена.");
    } catch {
      await ctx.reply("Не удалось отклонить заявку — нет прав HRD или заявка уже обработана.");
    }
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
    if (!(await requireActiveUser(ctx))) return;
    await ctx.reply(
      "Чтобы создать обращение, используйте /new. Чтобы посмотреть свои обращения — /my.",
    );
  });

  bot.catch((err) => {
    console.error("Ошибка обработчика бота:", err.error);
  });

  return bot;
}
