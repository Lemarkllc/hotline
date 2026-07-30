import type { Context, SessionFlavor } from "grammy";
import type { Conversation, ConversationFlavor } from "@grammyjs/conversations";

export interface SessionData {
  /** Установлено кнопкой "Написать сообщение" в карточке обращения ИЛИ доставкой
   * уведомления "sales_message" (см. notificationHandler.ts) — следующее текстовое
   * сообщение клиента уходит как реплика в переписку по этому обращению. Вложений
   * здесь по-прежнему нет (см. appealService "Канал CUSTOMER"), поэтому
   * draftAttachmentIds из bot-employee сюда не переносится. */
  awaitingReplyForAppealId?: string;
}

export type BotContext = ConversationFlavor<Context & SessionFlavor<SessionData>>;

export type BotConversation = Conversation<BotContext, Context & SessionFlavor<SessionData>>;
