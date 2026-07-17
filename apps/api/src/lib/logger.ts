import pino from "pino";
import { config } from "@/config/unifiedConfig.js";
import { captureException } from "@/instrument.js";

export const logger = pino({
  level: config.isProduction ? "info" : "debug",
  transport: config.isProduction
    ? undefined
    : { target: "pino-pretty", options: { colorize: true } },
});

/** Единая точка, куда стекаются ошибки приложения: лог + Sentry (если настроен). */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  logger.error({ err: error, ...context });
  void captureException(error);
}
