export { telegramAuthSchema, webLoginSchema } from "@hotline/shared";
import { z } from "zod";

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const twoFactorSetupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const twoFactorConfirmSchema = twoFactorSetupSchema.extend({
  code: z.string().length(6),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12, "Пароль не короче 12 символов"),
});
