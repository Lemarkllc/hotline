import { InlineKeyboard } from "grammy";
import {
  APPEAL_MODE_LABELS,
  APPEAL_STATUS_LABELS,
  EMPLOYEE_APPEAL_TYPE_LABELS,
  type EmployeeAppealType,
} from "@hotline/shared";
import { apiClient } from "./api.js";
import { ratingKeyboard } from "./keyboards.js";
import type { BotContext } from "./types.js";

type AppealBucket = "OPEN" | "CLOSED";

const PAGE_SIZE: Record<AppealBucket, number> = { OPEN: 5, CLOSED: 10 };

interface AppealListItem {
  id: string;
  publicNumber: string;
  type: string;
  status: string;
  createdAt: string;
  rating: { score: number } | null;
}

/** Точка входа "Мои обращения" (/my, меню) — сперва выбор вкладки, а не общий список,
 * иначе открытые (требуют действия) теряются среди давно закрытых. */
export async function renderMyAppealsMenu(ctx: BotContext): Promise<void> {
  const kb = new InlineKeyboard().text("Открытые", "my_list:OPEN:1").row().text("Закрытые", "my_list:CLOSED:1");
  await ctx.reply("Мои обращения:", { reply_markup: kb });
}

/** SRS §35.9 — список последних обращений с пагинацией кнопками, отдельно по вкладкам. */
export async function renderMyAppealsPage(ctx: BotContext, bucket: AppealBucket, page: number): Promise<void> {
  const telegramId = String(ctx.from!.id);
  const pageSize = PAGE_SIZE[bucket];
  const { items, total } = await apiClient.listMyAppeals(telegramId, page, pageSize, bucket);
  const list = items as unknown as AppealListItem[];

  const bucketLabel = bucket === "OPEN" ? "Открытые" : "Закрытые";
  if (!list.length) {
    await ctx.reply(page === 1 ? `${bucketLabel}: пока пусто.` : "Больше обращений нет.");
    return;
  }

  const kb = new InlineKeyboard();
  for (const appeal of list) {
    const label = `${appeal.publicNumber} — ${EMPLOYEE_APPEAL_TYPE_LABELS[appeal.type as EmployeeAppealType] ?? appeal.type} (${APPEAL_STATUS_LABELS[appeal.status as keyof typeof APPEAL_STATUS_LABELS]})`;
    kb.text(label, `my_detail:${appeal.id}`).row();
  }
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (page > 1) kb.text("« Назад", `my_page:${bucket}:${page - 1}`);
  if (page < totalPages) kb.text("Ещё »", `my_page:${bucket}:${page + 1}`);

  await ctx.reply(`${bucketLabel} (стр. ${page} из ${totalPages}):`, { reply_markup: kb });
}

export async function renderAppealDetail(ctx: BotContext, appealId: string): Promise<void> {
  const telegramId = String(ctx.from!.id);
  const appeal = (await apiClient.getMyAppeal(telegramId, appealId)) as unknown as {
    publicNumber: string;
    type: EmployeeAppealType;
    mode: "OPEN" | "CONFIDENTIAL";
    status: keyof typeof APPEAL_STATUS_LABELS;
    createdAt: string;
    rating: { score: number } | null;
    messages: { fromHrd: boolean; text: string }[];
  };

  const lastMessages = appeal.messages
    .slice(-3)
    .map((m) => `${m.fromHrd ? "HRD" : "Вы"}: ${m.text}`)
    .join("\n");

  const needsRating = appeal.status === "CLOSED" && !appeal.rating;
  // Написать HRD можно только по ещё не закрытому обращению — по закрытому диалог
  // формально завершён (при необходимости сотрудник переоткрывает через HRD).
  const canAsk = appeal.status !== "CLOSED";

  let keyboard: InlineKeyboard | undefined;
  if (needsRating) {
    keyboard = ratingKeyboard(appealId);
  } else if (canAsk) {
    keyboard = new InlineKeyboard().text("Задать вопрос по обращению", `my_ask:${appealId}`);
  }

  await ctx.reply(
    `Обращение ${appeal.publicNumber}\n` +
      `Тип: ${EMPLOYEE_APPEAL_TYPE_LABELS[appeal.type]}\n` +
      `Режим: ${APPEAL_MODE_LABELS[appeal.mode]}\n` +
      `Статус: ${APPEAL_STATUS_LABELS[appeal.status]}\n` +
      (lastMessages ? `\nПоследние сообщения:\n${lastMessages}\n` : "") +
      (needsRating ? "\nОцените, пожалуйста, насколько результат решил вопрос." : ""),
    keyboard ? { reply_markup: keyboard } : undefined,
  );
}
