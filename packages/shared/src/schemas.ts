import { z } from "zod";
import { APPEAL_MODES, CUSTOMER_APPEAL_TYPES, EMPLOYEE_APPEAL_TYPES } from "./enums.js";

/** Используется и ботом (перед отправкой в API), и API (как источник валидации на сервере). */
export const createEmployeeAppealSchema = z.object({
  type: z.enum(EMPLOYEE_APPEAL_TYPES),
  mode: z.enum(APPEAL_MODES),
  originalText: z.string().trim().min(1, "Текст обращения обязателен").max(8000),
  attachmentIds: z.array(z.string().uuid()).max(10, "Не более 10 вложений").default([]),
});
export type CreateEmployeeAppealInput = z.infer<typeof createEmployeeAppealSchema>;

/** Фаза 7 (PLAN.md §6) — тот же режим OPEN/CONFIDENTIAL, что и у сотрудников (решено
 * 17.07.2026), но короче список типов (см. CUSTOMER_APPEAL_TYPES). */
export const createCustomerAppealSchema = z.object({
  type: z.enum(CUSTOMER_APPEAL_TYPES),
  mode: z.enum(APPEAL_MODES),
  originalText: z.string().trim().min(1, "Текст обращения обязателен").max(8000),
  attachmentIds: z.array(z.string().uuid()).max(10, "Не более 10 вложений").default([]),
});
export type CreateCustomerAppealInput = z.infer<typeof createCustomerAppealSchema>;

export const telegramAuthSchema = z.object({
  telegramId: z.union([z.string(), z.number()]).transform((v) => String(v)),
  fullName: z.string().trim().min(1).max(200).optional(),
});
export type TelegramAuthInput = z.infer<typeof telegramAuthSchema>;

/** У ExternalContact нет approval-флоу (в отличие от telegramAuthSchema для сотрудников) —
 * зато есть обязательное согласие. Оба поля опциональны на схеме, т.к. первый вызов бота
 * идёт без них (409 "нужно имя", см. authService аналог для CUSTOMER); второй вызов —
 * уже после того, как бот собрал имя и показал текст согласия — несёт оба сразу. */
export const externalContactAuthSchema = z.object({
  telegramId: z.union([z.string(), z.number()]).transform((v) => String(v)),
  fullName: z.string().trim().min(1).max(200).optional(),
  consentVersion: z.string().trim().min(1).optional(),
});
export type ExternalContactAuthInput = z.infer<typeof externalContactAuthSchema>;

export const webLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().length(6).optional(),
});
export type WebLoginInput = z.infer<typeof webLoginSchema>;

export const ratingSchema = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});
export type RatingInput = z.infer<typeof ratingSchema>;

/** Фаза 7 (PLAN.md §6, решено 30.07.2026) — два отдельных вопроса вместо одного
 * score/comment: "порекомендовали бы" / "обратитесь ли снова", оба обязательны. */
export const customerRatingSchema = z.object({
  wouldRecommendScore: z.number().int().min(1).max(5),
  wouldReturnScore: z.number().int().min(1).max(5),
});
export type CustomerRatingInput = z.infer<typeof customerRatingSchema>;

export const createCommentSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  visibility: z.enum(["INTERNAL", "PUBLIC"]),
  isFinalAnswer: z.boolean().default(false),
  /** @упоминания во "Внутренней работе" — сервис сам пересекает с реальным списком
   * тегаемых для этого обращения (назначенные + HRD/Admin), невалидные id тихо
   * игнорируются, а не 400. */
  mentionedUserIds: z.array(z.string().uuid()).max(20).optional(),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationInput = z.infer<typeof paginationSchema>;
