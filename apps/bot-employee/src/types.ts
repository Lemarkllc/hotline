import type { Context, SessionFlavor } from "grammy";
import type { Conversation, ConversationFlavor } from "@grammyjs/conversations";

export interface SessionData {
  /** Установлено доставкой уведомления "hrd_message" (см. notificationHandler.ts) —
   * следующее текстовое сообщение пользователя трактуется как ответ на уточнение
   * по этому обращению (SRS §35.10: "Ответ пользователя привязывается к нужной карточке"). */
  awaitingReplyForAppealId?: string;
  /** Присутствие массива (даже пустого) означает "сейчас собираем вложения" — фото/видео
   * обрабатываются обычными хендлерами вне conversation (см. bot.ts), а не через
   * conversation.external() в цикле: у @grammyjs/conversations известная проблема —
   * повторный external() внутри цикла может намертво подвесить механизм повтора разговора
   * (https://github.com/grammyjs/conversations/issues/32), что и было причиной зависания
   * бота после второго фото. */
  draftAttachmentIds?: string[];
}

/** OC — контекст вне conversation-функций (с обоими флейворами: session + conversations). */
export type BotContext = ConversationFlavor<Context & SessionFlavor<SessionData>>;

/** C — контекст ВНУТРИ conversation-функций. Согласно canonical-паттерну @grammyjs/conversations
 * он должен быть БЕЗ ConversationFlavor (иначе ломается инференс типов createConversation), но
 * SessionFlavor нужен — это официально документированный способ читать/писать ctx.session внутри
 * conversation.external((ctx) => ...). */
export type BotConversation = Conversation<BotContext, Context & SessionFlavor<SessionData>>;
