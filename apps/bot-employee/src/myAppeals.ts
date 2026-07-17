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

const PAGE_SIZE = 5;

interface AppealListItem {
  id: string;
  publicNumber: string;
  type: string;
  status: string;
  createdAt: string;
  rating: { score: number } | null;
}

/** SRS §35.9 — список последних обращений с пагинацией кнопками. */
export async function renderMyAppealsPage(ctx: BotContext, page: number): Promise<void> {
  const telegramId = String(ctx.from!.id);
  const { items, total } = await apiClient.listMyAppeals(telegramId, page, PAGE_SIZE);
  const list = items as unknown as AppealListItem[];

  if (!list.length) {
    await ctx.reply(page === 1 ? "У вас пока нет обращений." : "Больше обращений нет.");
    return;
  }

  const kb = new InlineKeyboard();
  for (const appeal of list) {
    const label = `${appeal.publicNumber} — ${EMPLOYEE_APPEAL_TYPE_LABELS[appeal.type as EmployeeAppealType] ?? appeal.type} (${APPEAL_STATUS_LABELS[appeal.status as keyof typeof APPEAL_STATUS_LABELS]})`;
    kb.text(label, `my_detail:${appeal.id}`).row();
  }
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > 1) kb.text("« Назад", `my_page:${page - 1}`);
  if (page < totalPages) kb.text("Вперёд »", `my_page:${page + 1}`);

  await ctx.reply(`Ваши обращения (стр. ${page} из ${totalPages}):`, { reply_markup: kb });
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

  await ctx.reply(
    `Обращение ${appeal.publicNumber}\n` +
      `Тип: ${EMPLOYEE_APPEAL_TYPE_LABELS[appeal.type]}\n` +
      `Режим: ${APPEAL_MODE_LABELS[appeal.mode]}\n` +
      `Статус: ${APPEAL_STATUS_LABELS[appeal.status]}\n` +
      (lastMessages ? `\nПоследние сообщения:\n${lastMessages}\n` : "") +
      (appeal.status === "CLOSED" && !appeal.rating
        ? "\nОцените, пожалуйста, насколько результат решил вопрос."
        : ""),
    appeal.status === "CLOSED" && !appeal.rating
      ? { reply_markup: ratingKeyboard(appealId) }
      : undefined,
  );
}
