import { randomBytes } from "node:crypto";

/** Общий генератор временных паролей — используется при создании веб-аккаунта и
 * при сбросе пароля (userService), раньше был продублирован в обоих местах. */
export function generateTemporaryPassword(): string {
  return randomBytes(9).toString("base64url");
}
