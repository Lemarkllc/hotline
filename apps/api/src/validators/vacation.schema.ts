import { z } from "zod";
import {
  createVacationRequestSchema,
  refineVacationDateRange,
  rejectHrRequestSchema,
  VACATION_STATUSES,
} from "@hotline/shared";

export { rejectHrRequestSchema };

const telegramIdField = z.union([z.string(), z.number()]).transform((v) => String(v));

/** Заявка на отпуск всегда создаётся ботом от имени конкретного Telegram-пользователя —
 * тот же приём, что createAppealBotSchema в appeal.schema.ts: .extend() поверх голого
 * ZodObject из packages/shared, затем .superRefine() (не раньше — .extend() недоступен
 * на ZodEffects, см. комментарий у createVacationRequestSchema). */
export const createVacationRequestBotSchema = createVacationRequestSchema
  .extend({ telegramId: telegramIdField })
  .superRefine(refineVacationDateRange);

export const listVacationRequestsQuerySchema = z.object({
  status: z.enum(VACATION_STATUSES).optional(),
});

export const vacationBalanceQuerySchema = z.object({
  telegramId: telegramIdField,
});
