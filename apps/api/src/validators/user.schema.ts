import { z } from "zod";
import { ROLE_NAMES } from "@hotline/shared";

export const decideAccessRequestSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const blockUserSchema = z.object({
  reason: z.string().trim().min(1, "Причина блокировки обязательна").max(500),
});

export const createWebAccountSchema = z.object({
  email: z.string().email(),
  fullName: z.string().trim().min(1).max(200),
  temporaryPassword: z.string().min(12, "Пароль не короче 12 символов"),
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

export const botDecideAccessRequestSchema = z.object({
  telegramId: z.union([z.string(), z.number()]).transform(String),
  reason: z.string().trim().max(500).optional(),
});
