import { Redis } from "ioredis";
import { config } from "./config.js";

/** Общий клиент: используется и grammy session-хранилищем, и notificationHandler
 * (последнему нужно писать в сессию напрямую, вне контекста апдейта). */
export const redis = new Redis(config.redisUrl);

export const SESSION_PREFIX = "bot-employee:session";
