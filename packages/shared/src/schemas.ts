import { z } from "zod";
import { APPEAL_MODES, EMPLOYEE_APPEAL_TYPES } from "./enums.js";

/** Используется и ботом (перед отправкой в API), и API (как источник валидации на сервере). */
export const createEmployeeAppealSchema = z.object({
  type: z.enum(EMPLOYEE_APPEAL_TYPES),
  mode: z.enum(APPEAL_MODES),
  originalText: z.string().trim().min(1, "Текст обращения обязателен").max(8000),
  attachmentIds: z.array(z.string().uuid()).max(10, "Не более 10 вложений").default([]),
});
export type CreateEmployeeAppealInput = z.infer<typeof createEmployeeAppealSchema>;

export const telegramAuthSchema = z.object({
  telegramId: z.union([z.string(), z.number()]).transform((v) => String(v)),
  fullName: z.string().trim().min(1).max(200).optional(),
});
export type TelegramAuthInput = z.infer<typeof telegramAuthSchema>;

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

export const createCommentSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  visibility: z.enum(["INTERNAL", "PUBLIC"]),
  isFinalAnswer: z.boolean().default(false),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationInput = z.infer<typeof paginationSchema>;
