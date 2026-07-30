import { z } from "zod";
import {
  APPEAL_STATUSES,
  createCustomerAppealSchema,
  createEmployeeAppealSchema,
  customerRatingSchema,
  paginationSchema,
} from "@hotline/shared";

export { ratingSchema, createCommentSchema } from "@hotline/shared";

const telegramIdField = z.union([z.string(), z.number()]).transform((v) => String(v));

/** Обращение всегда создаётся ботом от имени конкретного Telegram-пользователя. */
export const createAppealBotSchema = createEmployeeAppealSchema.extend({
  telegramId: telegramIdField,
});

/** Фаза 7 (PLAN.md §6) — бот клиентов, без attachmentIds в этом заходе (см.
 * appealService "Канал CUSTOMER"). */
export const createCustomerAppealBotSchema = createCustomerAppealSchema.omit({ attachmentIds: true }).extend({
  telegramId: telegramIdField,
});

export const customerRatingBotSchema = customerRatingSchema.extend({
  telegramId: telegramIdField,
});

export const listAppealsQuerySchema = paginationSchema.extend({
  channel: z.enum(["EMPLOYEE", "CUSTOMER"]).default("EMPLOYEE"),
  status: z.enum(APPEAL_STATUSES).optional(),
  /** "Активные" по умолчанию на web (Реестр/Kanban) — всё, кроме CLOSED, чтобы не
   * заполнять рабочее пространство закрытыми обращениями (см. обсуждение с
   * пользователем). Взаимоисключимо со status — задаётся, когда status не задан. */
  excludeStatus: z.enum(APPEAL_STATUSES).optional(),
  type: z.string().optional(),
  epicId: z.string().uuid().optional(),
  mode: z.enum(["OPEN", "CONFIDENTIAL"]).optional(),
  assigneeId: z.string().uuid().optional(),
  search: z.string().optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  ratingScore: z.coerce.number().int().min(1).max(5).optional(),
  /** Бэклог = ещё не разобранные обращения: Открыто/На проверке и без назначенного
   * (не "любой список", а конкретное подмножество — см. обсуждение с пользователем). */
  backlogOnly: z.coerce.boolean().optional(),
  lowRatingOnly: z.coerce.boolean().optional(),
});

export const myAppealsQuerySchema = paginationSchema.extend({
  telegramId: telegramIdField,
  bucket: z.enum(["OPEN", "CLOSED"]).default("OPEN"),
});

export const revealAuthorSchema = z.object({
  password: z.string().min(1, "Пароль обязателен"),
});

/** Закрытие требует итогового ответа (FR-WF-005) — валидируется в сервисе, не только здесь. */
export const changeStatusSchema = z.object({
  toStatus: z.enum(APPEAL_STATUSES),
  reason: z.string().trim().max(1000).optional(),
  finalAnswer: z.string().trim().max(4000).optional(),
});

export const assignSchema = z.object({
  userId: z.string().uuid(),
});

export const workingEditSchema = z.object({
  workingEdit: z.string().trim().min(1).max(8000),
});

export const setEpicSchema = z.object({
  epicId: z.string().uuid().nullable(),
});

export const createMessageSchema = z.object({
  text: z.string().trim().min(1).max(4000),
});

export const botCreateMessageSchema = createMessageSchema.extend({
  telegramId: telegramIdField,
});
