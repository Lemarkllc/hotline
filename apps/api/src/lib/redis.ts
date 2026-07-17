import { Redis } from "ioredis";
import { config } from "@/config/unifiedConfig.js";

export const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});
