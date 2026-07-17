// Первый импорт в server.ts (backend-dev-guidelines требует Sentry как первый импорт).
// Без SENTRY_DSN работает как no-op, чтобы локальная разработка не зависела от внешнего сервиса.
import { config } from "@/config/unifiedConfig.js";

let sentryEnabled = false;

export async function initSentry(): Promise<void> {
  if (!config.sentry.dsn) {
    return;
  }
  const Sentry = await import("@sentry/node");
  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.env,
    tracesSampleRate: config.isProduction ? 0.1 : 1.0,
  });
  sentryEnabled = true;
}

export async function captureException(error: unknown): Promise<void> {
  if (sentryEnabled) {
    const Sentry = await import("@sentry/node");
    Sentry.captureException(error);
  }
}
