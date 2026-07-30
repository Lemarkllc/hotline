import type { Context, SessionFlavor } from "grammy";
import type { Conversation, ConversationFlavor } from "@grammyjs/conversations";

/** Пусто — в отличие от bot-employee, тут не нужны ни draftAttachmentIds (вложений нет
 * в этом заходе, см. appealService "Канал CUSTOMER"), ни awaitingReplyForAppealId
 * (нет флоу ответа на уточнение у клиента). session() всё равно обязателен — на нём
 * держится сам механизм @grammyjs/conversations, даже без собственных полей. */
export type SessionData = Record<string, never>;

export type BotContext = ConversationFlavor<Context & SessionFlavor<SessionData>>;

export type BotConversation = Conversation<BotContext, Context & SessionFlavor<SessionData>>;
