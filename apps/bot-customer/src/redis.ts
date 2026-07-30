import { Redis } from "ioredis";
import { config } from "./config.js";

/** Общий Redis с bot-employee, отдельный префикс ключей сессии — коллизий нет. */
export const redis = new Redis(config.redisUrl);

export const SESSION_PREFIX = "bot-customer:session";
