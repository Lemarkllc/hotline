import type { Context, SessionFlavor } from "grammy";
import type { Conversation, ConversationFlavor } from "@grammyjs/conversations";

export interface SessionData {
  /** Установлено доставкой уведомления "hrd_message" (см. notificationHandler.ts) —
   * следующее текстовое сообщение пользователя трактуется как ответ на уточнение
   * по этому обращению (SRS §35.10: "Ответ пользователя привязывается к нужной карточке"). */
  awaitingReplyForAppealId?: string;
}

/** OC — контекст вне conversation-функций (с обоими флейворами: session + conversations). */
export type BotContext = ConversationFlavor<Context & SessionFlavor<SessionData>>;

/** C — контекст ВНУТРИ conversation-функций. Согласно canonical-паттерну @grammyjs/conversations
 * он должен быть БЕЗ ConversationFlavor (иначе ломается инференс типов createConversation). */
export type BotConversation = Conversation<BotContext, Context>;
