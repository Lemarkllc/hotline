import { InlineKeyboard } from "grammy";
import type { Context } from "grammy";
import { BUSINESS_TRIP_TRANSPORT_LABELS, type BusinessTripTransport } from "@hotline/shared";
import { apiClient } from "../api.js";
import { DATE_FORMAT_HINT, formatDate, parseDate } from "../dateInput.js";
import {
  businessTripHotelKeyboard,
  businessTripPreviewKeyboard,
  businessTripTransportKeyboard,
  MAIN_MENU_KEYBOARD,
} from "../keyboards.js";
import type { BotConversation } from "../types.js";

const CANCEL_KEYBOARD = new InlineKeyboard().text("Отменить", "cancel");

type Transport = { kind: BusinessTripTransport; other?: string };

function formatTransport(transport: Transport): string {
  const label = BUSINESS_TRIP_TRANSPORT_LABELS[transport.kind];
  return transport.kind === "OTHER" && transport.other ? `${label} (${transport.other})` : label;
}

/** «Командировка» (BusinessTripRequest, PLAN.md §10) — новая сущность, тот же
 * workflow, что у Vacation/Absence. Даты → цель (обязательна, иначе HRD согласовывает
 * вслепую) → транспорт (для понимания оплаты топлива/билетов) → нужен ли отель. */
export async function businessTrip(conversation: BotConversation, ctx: Context): Promise<void> {
  const telegramId = String(ctx.from!.id);

  async function cancelled(): Promise<void> {
    await ctx.reply("Заявка на командировку отменена.", { reply_markup: MAIN_MENU_KEYBOARD });
  }

  async function collectDate(prompt: string): Promise<Date | "cancel"> {
    await ctx.reply(prompt, { reply_markup: CANCEL_KEYBOARD });
    for (;;) {
      const result = await conversation.waitFor(["message:text", "callback_query:data"]);
      if (result.callbackQuery) {
        await result.answerCallbackQuery();
        if (result.callbackQuery.data === "cancel") return "cancel";
        continue;
      }
      const parsed = parseDate(result.message!.text);
      if (!parsed) {
        await ctx.reply(`Не получилось распознать дату. Отправьте ${DATE_FORMAT_HINT}.`, {
          reply_markup: CANCEL_KEYBOARD,
        });
        continue;
      }
      return parsed;
    }
  }

  async function collectDateTo(dateFrom: Date): Promise<Date | "cancel"> {
    for (;;) {
      const result = await collectDate(`Дата окончания командировки (${DATE_FORMAT_HINT}):`);
      if (result === "cancel") return "cancel";
      if (result < dateFrom) {
        await ctx.reply("Дата окончания раньше даты начала — отправьте дату окончания ещё раз.");
        continue;
      }
      return result;
    }
  }

  async function collectPurpose(): Promise<string | "cancel"> {
    await ctx.reply("Цель командировки (обязательно) — например, к какому клиенту/объекту и зачем:", {
      reply_markup: CANCEL_KEYBOARD,
    });
    for (;;) {
      const result = await conversation.waitFor(["message:text", "callback_query:data"]);
      if (result.callbackQuery) {
        await result.answerCallbackQuery();
        if (result.callbackQuery.data === "cancel") return "cancel";
        continue;
      }
      const text = result.message!.text.trim();
      if (!text) {
        await ctx.reply("Цель командировки не может быть пустой.", { reply_markup: CANCEL_KEYBOARD });
        continue;
      }
      return text;
    }
  }

  async function collectTransport(): Promise<Transport | "cancel"> {
    await ctx.reply("Как будете добираться?", { reply_markup: businessTripTransportKeyboard() });
    const answer = await conversation.waitForCallbackQuery(/^(transport:|cancel)/);
    await answer.answerCallbackQuery();
    if (answer.callbackQuery.data === "cancel") return "cancel";
    const kind = answer.callbackQuery.data.split(":")[1] as BusinessTripTransport;
    if (kind !== "OTHER") return { kind };

    await ctx.reply("Уточните, как именно:", { reply_markup: CANCEL_KEYBOARD });
    for (;;) {
      const result = await conversation.waitFor(["message:text", "callback_query:data"]);
      if (result.callbackQuery) {
        await result.answerCallbackQuery();
        if (result.callbackQuery.data === "cancel") return "cancel";
        continue;
      }
      const other = result.message!.text.trim();
      if (!other) {
        await ctx.reply("Уточнение не может быть пустым.", { reply_markup: CANCEL_KEYBOARD });
        continue;
      }
      return { kind, other };
    }
  }

  async function collectHotel(): Promise<boolean | "cancel"> {
    await ctx.reply("Нужен ли отель (для ночёвки)?", { reply_markup: businessTripHotelKeyboard() });
    const answer = await conversation.waitForCallbackQuery(/^(hotel:|cancel)/);
    await answer.answerCallbackQuery();
    if (answer.callbackQuery.data === "cancel") return "cancel";
    return answer.callbackQuery.data === "hotel:true";
  }

  let dateFrom = await collectDate(`Дата начала командировки (${DATE_FORMAT_HINT}):`);
  if (dateFrom === "cancel") return cancelled();

  let dateTo = await collectDateTo(dateFrom);
  if (dateTo === "cancel") return cancelled();

  let purpose = await collectPurpose();
  if (purpose === "cancel") return cancelled();

  let transport = await collectTransport();
  if (transport === "cancel") return cancelled();

  let hotelNeeded = await collectHotel();
  if (hotelNeeded === "cancel") return cancelled();

  for (;;) {
    await ctx.reply(
      `С ${formatDate(dateFrom)} по ${formatDate(dateTo)}\n` +
        `Цель: ${purpose}\n` +
        `Транспорт: ${formatTransport(transport)}\n` +
        `Отель: ${hotelNeeded ? "нужен" : "не нужен"}\n\n` +
        "Проверьте данные перед отправкой.",
      { reply_markup: businessTripPreviewKeyboard() },
    );
    const answer = await conversation.waitForCallbackQuery([
      "submit",
      "edit_dates",
      "edit_purpose",
      "edit_transport",
      "edit_hotel",
      "cancel",
    ]);
    await answer.answerCallbackQuery();

    if (answer.callbackQuery.data === "cancel") return cancelled();
    if (answer.callbackQuery.data === "submit") break;
    if (answer.callbackQuery.data === "edit_dates") {
      const newFrom = await collectDate(`Дата начала командировки (${DATE_FORMAT_HINT}):`);
      if (newFrom === "cancel") return cancelled();
      const newTo = await collectDateTo(newFrom);
      if (newTo === "cancel") return cancelled();
      dateFrom = newFrom;
      dateTo = newTo;
    }
    if (answer.callbackQuery.data === "edit_purpose") {
      const result = await collectPurpose();
      if (result === "cancel") return cancelled();
      purpose = result;
    }
    if (answer.callbackQuery.data === "edit_transport") {
      const result = await collectTransport();
      if (result === "cancel") return cancelled();
      transport = result;
    }
    if (answer.callbackQuery.data === "edit_hotel") {
      const result = await collectHotel();
      if (result === "cancel") return cancelled();
      hotelNeeded = result;
    }
  }

  const created = await conversation.external(() =>
    apiClient.createBusinessTripRequest({
      telegramId,
      dateFrom,
      dateTo,
      purpose,
      transport: transport.kind,
      transportOther: transport.other,
      hotelNeeded,
    }),
  );

  await ctx.reply(
    `Заявка на командировку зарегистрирована под номером ${created.publicNumber}.\n` +
      "Вы получите уведомление, когда HRD примет решение.",
    { reply_markup: MAIN_MENU_KEYBOARD },
  );
}
