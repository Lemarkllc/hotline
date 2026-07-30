import { InlineKeyboard } from "grammy";
import { APPEAL_MODE_LABELS, APPEAL_STATUS_LABELS, CUSTOMER_APPEAL_TYPE_LABELS, type CustomerAppealType } from "@hotline/shared";
import { apiClient } from "./api.js";
import { npsRecommendKeyboard } from "./keyboards.js";
import type { BotContext } from "./types.js";

type AppealBucket = "OPEN" | "CLOSED";

const PAGE_SIZE: Record<AppealBucket, number> = { OPEN: 5, CLOSED: 10 };

interface AppealListItem {
  id: string;
  publicNumber: string;
  type: string;
  status: string;
  createdAt: string;
  rating: { wouldRecommendScore: number | null } | null;
}

export async function renderMyAppealsMenu(ctx: BotContext): Promise<void> {
  const kb = new InlineKeyboard().text("Открытые", "my_list:OPEN:1").row().text("Закрытые", "my_list:CLOSED:1");
  await ctx.reply("Мои обращения:", { reply_markup: kb });
}

export async function renderMyAppealsPage(ctx: BotContext, bucket: AppealBucket, page: number): Promise<void> {
  const telegramId = String(ctx.from!.id);
  const pageSize = PAGE_SIZE[bucket];
  const { items, total } = await apiClient.listMyCustomerAppeals(telegramId, page, pageSize, bucket);
  const list = items as unknown as AppealListItem[];

  const bucketLabel = bucket === "OPEN" ? "Открытые" : "Закрытые";
  if (!list.length) {
    await ctx.reply(page === 1 ? `${bucketLabel}: пока пусто.` : "Больше обращений нет.");
    return;
  }

  const kb = new InlineKeyboard();
  for (const appeal of list) {
    const label = `${appeal.publicNumber} — ${CUSTOMER_APPEAL_TYPE_LABELS[appeal.type as CustomerAppealType] ?? appeal.type} (${APPEAL_STATUS_LABELS[appeal.status as keyof typeof APPEAL_STATUS_LABELS]})`;
    kb.text(label, `my_detail:${appeal.id}`).row();
  }
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (page > 1) kb.text("« Назад", `my_page:${bucket}:${page - 1}`);
  if (page < totalPages) kb.text("Ещё »", `my_page:${bucket}:${page + 1}`);

  await ctx.reply(`${bucketLabel} (стр. ${page} из ${totalPages}):`, { reply_markup: kb });
}

export async function renderAppealDetail(ctx: BotContext, appealId: string): Promise<void> {
  const telegramId = String(ctx.from!.id);
  const appeal = (await apiClient.getMyCustomerAppeal(telegramId, appealId)) as unknown as {
    publicNumber: string;
    type: CustomerAppealType;
    mode: "OPEN" | "CONFIDENTIAL";
    status: keyof typeof APPEAL_STATUS_LABELS;
    rating: { wouldRecommendScore: number | null } | null;
    messages: { fromHrd: boolean; fromFullName: string | null; text: string }[];
  };

  const lastMessages = appeal.messages
    .slice(-3)
    .map((m) => `${m.fromHrd ? (m.fromFullName ?? "Компания") : "Вы"}: ${m.text}`)
    .join("\n");

  const needsRating = appeal.status === "CLOSED" && !appeal.rating;
  // Написать можно только по ещё не закрытому обращению — appealService.addExternalContactReply
  // отклонит попытку по закрытому (та же граница, что и у сотрудников).
  const canAsk = appeal.status !== "CLOSED";

  let keyboard: InlineKeyboard | undefined;
  if (needsRating) {
    keyboard = npsRecommendKeyboard(appealId);
  } else if (canAsk) {
    keyboard = new InlineKeyboard().text("Написать сообщение", `my_ask:${appealId}`);
  }

  await ctx.reply(
    `Обращение ${appeal.publicNumber}\n` +
      `Тип: ${CUSTOMER_APPEAL_TYPE_LABELS[appeal.type]}\n` +
      `Режим: ${APPEAL_MODE_LABELS[appeal.mode]}\n` +
      `Статус: ${APPEAL_STATUS_LABELS[appeal.status]}\n` +
      (lastMessages ? `\nПоследние сообщения:\n${lastMessages}\n` : "") +
      (needsRating ? "\nПорекомендовали бы вы нас?" : ""),
    keyboard ? { reply_markup: keyboard } : undefined,
  );
}
