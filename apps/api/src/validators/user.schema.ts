import { z } from "zod";
import { CHANNELS, ROLE_NAMES } from "@hotline/shared";

export const decideAccessRequestSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const blockUserSchema = z.object({
  reason: z.string().trim().min(1, "Причина блокировки обязательна").max(500),
});

export const createWebAccountSchema = z.object({
  email: z.string().email(),
  fullName: z.string().trim().min(1).max(200),
  roleNames: z.array(z.enum(ROLE_NAMES)).min(1),
});

export const listUsersQuerySchema = z.object({
  status: z.string().optional(),
});

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(1).max(200).optional(),
  telegramId: z
    .union([z.string(), z.number()])
    .transform(String)
    .nullable()
    .optional(),
  roleNames: z.array(z.enum(ROLE_NAMES)).min(1).optional(),
});

/** min(1) — намеренно: полная замена набора (см. updateChannelAccess в userService),
 * пустой массив молча стирает ВЕСЬ доступ к обращениям без предупреждения — ровно
 * так один раз лишился доступа собственный Администратор (найдено вживую на проде,
 * см. audit_log user.channels_updated). Полностью отрезать пользователя от каналов
 * можно через блокировку аккаунта — не через оставление списка каналов пустым. */
export const updateChannelAccessSchema = z.object({
  channels: z.array(z.enum(CHANNELS)).min(1, "Нужно выбрать хотя бы один канал"),
});

export const botDecideAccessRequestSchema = z.object({
  telegramId: z.union([z.string(), z.number()]).transform(String),
  reason: z.string().trim().max(500).optional(),
});
