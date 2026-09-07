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
  /** Для формулы остатка отпуска (PLAN.md §10) — пока не заведён полноценный
   * бот-онбординг, HRD/Администратор вводит это вручную через UsersPage. */
  hireDate: z.coerce.date().nullable().optional(),
  /** Оба поля задаются только вместе — стартовый остаток без даты снимка бессмысленен. */
  startingBalance: z.number().min(0).optional(),
  balanceAsOfDate: z.coerce.date().optional(),
});

export const updateChannelAccessSchema = z.object({
  channels: z.array(z.enum(CHANNELS)),
});

export const botDecideAccessRequestSchema = z.object({
  telegramId: z.union([z.string(), z.number()]).transform(String),
  reason: z.string().trim().max(500).optional(),
});
