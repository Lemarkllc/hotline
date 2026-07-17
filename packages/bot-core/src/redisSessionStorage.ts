import type { Redis } from "ioredis";

/** grammy StorageAdapter (см. @grammyjs/storage — реализуем сами, чтобы не тянуть лишнюю зависимость). */
export interface StorageAdapter<T> {
  read(key: string): Promise<T | undefined>;
  write(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

// сессия/черновик переживает рестарт бота (SRS §15: "восстанавливается после перезапуска")
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 2;

export function createRedisSessionStorage<T>(redis: Redis, prefix: string): StorageAdapter<T> {
  const key = (k: string) => `${prefix}:${k}`;
  return {
    async read(k) {
      const raw = await redis.get(key(k));
      return raw ? (JSON.parse(raw) as T) : undefined;
    },
    async write(k, value) {
      await redis.set(key(k), JSON.stringify(value), "EX", SESSION_TTL_SECONDS);
    },
    async delete(k) {
      await redis.del(key(k));
    },
  };
}

/** Прямая правка сессии вне контекста апдейта — нужно поллеру уведомлений (см. bot-employee/notificationHandler.ts),
 * который узнаёт о новом сообщении HRD асинхронно, а не в ответ на действие пользователя в Telegram. */
export async function patchSession<T extends object>(
  redis: Redis,
  prefix: string,
  sessionKey: string,
  patch: Partial<T>,
): Promise<void> {
  const key = `${prefix}:${sessionKey}`;
  const raw = await redis.get(key);
  const current = raw ? (JSON.parse(raw) as T) : ({} as T);
  await redis.set(key, JSON.stringify({ ...current, ...patch }), "EX", SESSION_TTL_SECONDS);
}
