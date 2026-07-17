import type { User } from "@prisma/client";

/** API не должна возвращать скрытые поля (SRS §20) — хэш пароля и секрет TOTP никогда. */
export function sanitizeUser<T extends Partial<User>>(user: T) {
  const { passwordHash: _passwordHash, totpSecret: _totpSecret, ...rest } = user;
  return rest;
}
