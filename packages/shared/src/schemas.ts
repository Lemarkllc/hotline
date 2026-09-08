import { z } from "zod";
import { APPEAL_MODES, BUSINESS_TRIP_TRANSPORTS, CUSTOMER_APPEAL_TYPES, EMPLOYEE_APPEAL_TYPES } from "./enums.js";

/** Используется и ботом (перед отправкой в API), и API (как источник валидации на сервере).
 * Намеренно ОСТАЁТСЯ голым ZodObject (не .superRefine()) — apps/api/src/validators/
 * appeal.schema.ts делает .extend({ telegramId }) поверх него, а .extend() недоступен
 * на ZodEffects (результат .refine()/.superRefine()). Type/mode-специфичные правила
 * (RESIGNATION → mode всегда OPEN, вложение обязательно) навешаны через
 * refineEmployeeAppealRules() ПОСЛЕ .extend() в потребителе, а не здесь. */
export const createEmployeeAppealSchema = z.object({
  type: z.enum(EMPLOYEE_APPEAL_TYPES),
  mode: z.enum(APPEAL_MODES),
  originalText: z.string().trim().min(1, "Текст обращения обязателен").max(8000),
  attachmentIds: z.array(z.string().uuid()).max(10, "Не более 10 вложений").default([]),
});
export type CreateEmployeeAppealInput = z.infer<typeof createEmployeeAppealSchema>;

/** Заявление на увольнение — всегда открытое (HR физически не может обработать
 * анонимное увольнение) и требует хотя бы одно вложение (копия подписанного
 * заявления). Серверная проверка, не только шаг бота — иначе оба правила можно
 * обойти прямым вызовом API в обход диалога. Общая функция, а не .superRefine()
 * прямо на схеме — см. комментарий у createEmployeeAppealSchema про .extend(). */
export function refineEmployeeAppealRules<T extends { type: string; mode: string; attachmentIds: string[] }>(
  data: T,
  ctx: z.RefinementCtx,
): void {
  if (data.type !== "RESIGNATION") return;
  if (data.mode !== "OPEN") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["mode"],
      message: "Заявление на увольнение не может быть конфиденциальным",
    });
  }
  if (data.attachmentIds.length < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["attachmentIds"],
      message: "Заявление на увольнение требует фото копии подписанного заявления",
    });
  }
}

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

/** «Заявки» — email-лиды (PLAN.md). Причина стоп-листа необязательна (быстрое
 * действие РОП не должно требовать заполнения текста), но если указана — не пустая. */
export const stopListLeadSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});
export type StopListLeadInput = z.infer<typeof stopListLeadSchema>;

export const convertLeadToCrmSchema = z.object({
  bitrixUserId: z.string().trim().min(1, "Не выбран ответственный в Bitrix24"),
});
export type ConvertLeadToCrmInput = z.infer<typeof convertLeadToCrmSchema>;

export const replyToLeadSchema = z.object({
  body: z.string().trim().min(1, "Текст ответа не может быть пустым").max(8000),
});
export type ReplyToLeadInput = z.infer<typeof replyToLeadSchema>;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationInput = z.infer<typeof paginationSchema>;

/** «Отпуска» (VacationRequest) — голый ZodObject без telegramId и без .refine(),
 * тем же принципом, что и createEmployeeAppealSchema: apps/api/src/validators/
 * vacation.schema.ts делает .extend({ telegramId }) поверх него для бот-эндпоинта —
 * .extend() недоступен на ZodEffects, поэтому проверка dateTo>=dateFrom вынесена в
 * refineVacationDateRange() и навешивается через .superRefine() ПОСЛЕ .extend(). */
export const createVacationRequestSchema = z.object({
  dateFrom: z.coerce.date(),
  dateTo: z.coerce.date(),
  comment: z.string().trim().max(1000).optional(),
  /** true — оплачиваемый (проверяется против баланса, PLAN.md §10), false — за свой
   * счёт (без ограничения в коде — HRD решает при одобрении). */
  paid: z.boolean(),
  /** Фото заявления — обязательное вложение (прямое решение пользователя, тот же
   * min(1), что у RESIGNATION-обращений — см. refineEmployeeAppealRules). */
  attachmentIds: z.array(z.string().uuid()).min(1, "Нужно приложить фото заявления").max(10),
});
export type CreateVacationRequestInput = z.infer<typeof createVacationRequestSchema>;

export function refineVacationDateRange<T extends { dateFrom: Date; dateTo: Date }>(
  data: T,
  ctx: z.RefinementCtx,
): void {
  if (data.dateTo < data.dateFrom) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dateTo"], message: "Дата окончания раньше даты начала" });
  }
}

/** Причина отказа обязательна (прямое решение пользователя) — общая схема для всех
 * трёх сущностей раздела «Отпуска» (Vacation/Absence/BusinessTrip), в отличие от
 * stopListLeadSchema/decideAccessRequestSchema, где причина опциональна. */
export const rejectHrRequestSchema = z.object({
  reason: z.string().trim().min(1, "Причина отказа обязательна").max(500),
});
export type RejectHrRequestInput = z.infer<typeof rejectHrRequestSchema>;

/** «Отсутствие» (AbsenceRequest, было TIME_OFF внутри Appeal, PLAN.md §10) — дата,
 * время (диапазон) ИЛИ весь день, необязательная причина. Голый ZodObject без
 * .refine() — тем же принципом, что и createVacationRequestSchema (см. её комментарий):
 * .extend({telegramId}) в apps/api/src/validators/absence.schema.ts требует этого. */
export const createAbsenceRequestSchema = z.object({
  date: z.coerce.date(),
  fullDay: z.boolean(),
  timeFrom: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  timeTo: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  reason: z.string().trim().max(1000).optional(),
});
export type CreateAbsenceRequestInput = z.infer<typeof createAbsenceRequestSchema>;

export function refineAbsenceTimeRange<T extends { fullDay: boolean; timeFrom?: string; timeTo?: string }>(
  data: T,
  ctx: z.RefinementCtx,
): void {
  if (data.fullDay) return;
  if (!data.timeFrom || !data.timeTo) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["timeFrom"], message: "Укажите время начала и окончания" });
    return;
  }
  if (data.timeTo <= data.timeFrom) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["timeTo"], message: "Время окончания раньше времени начала" });
  }
}

/** «Командировка» (BusinessTripRequest, PLAN.md §10) — цель обязательна (без неё HRD
 * согласовывает вслепую, решение пользователя), транспорт из фиксированного списка,
 * уточнение текстом обязательно только при transport="OTHER" (см. refineBusinessTripRules). */
export const createBusinessTripRequestSchema = z.object({
  dateFrom: z.coerce.date(),
  dateTo: z.coerce.date(),
  purpose: z.string().trim().min(1, "Цель командировки обязательна").max(1000),
  transport: z.enum(BUSINESS_TRIP_TRANSPORTS),
  transportOther: z.string().trim().max(200).optional(),
  hotelNeeded: z.boolean(),
});
export type CreateBusinessTripRequestInput = z.infer<typeof createBusinessTripRequestSchema>;

export function refineBusinessTripRules<T extends { dateFrom: Date; dateTo: Date; transport: string; transportOther?: string }>(
  data: T,
  ctx: z.RefinementCtx,
): void {
  refineVacationDateRange(data, ctx);
  if (data.transport === "OTHER" && !data.transportOther) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["transportOther"], message: "Уточните способ добраться" });
  }
}
