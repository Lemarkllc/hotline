import { initSentry } from "@/instrument.js";

await initSentry();

const { app } = await import("@/app.js");
const { config } = await import("@/config/unifiedConfig.js");
const { logger } = await import("@/lib/logger.js");
const { attachmentService } = await import("@/services/attachmentService.js");
const { emailIngestService } = await import("@/services/emailIngestService.js");
const { leadAutoStopListService } = await import("@/services/leadAutoStopListService.js");
const { ensureBucketExists } = await import("@/lib/storage.js");
const { initRealtime } = await import("@/lib/realtime.js");

await ensureBucketExists();

const server = app.listen(config.server.port, () => {
  logger.info(`HotLineBot API запущен на порту ${config.server.port}`);
});
initRealtime(server);

// FR-DRF-006: черновики вложений старше 24ч удаляются из object storage.
const cleanupInterval = setInterval(() => {
  attachmentService.cleanupExpiredDrafts().catch((error) => logger.error({ err: error }, "cleanup failed"));
}, 60 * 60 * 1000);

// «Заявки» — поллинг robot@lemarkllc.ru (PLAN.md); no-op, пока не выданы IMAP-креды
// (см. emailIngestService.pollInbox).
const emailPollInterval = setInterval(() => {
  emailIngestService.pollInbox().catch((error) => logger.error({ err: error }, "email poll failed"));
}, config.email.pollIntervalMs);

// Дайджест авто-стоплиста (leadAutoStopListService) — сам метод не шлёт чаще раза в
// сутки (see DIGEST_HOUR_UTC), 30 минут просто с запасом ловит порог по времени.
const leadStopListDigestInterval = setInterval(() => {
  leadAutoStopListService.sendDailyDigestIfDue().catch((error) => logger.error({ err: error }, "lead stoplist digest failed"));
}, 30 * 60 * 1000);

function shutdown(): void {
  clearInterval(cleanupInterval);
  clearInterval(emailPollInterval);
  clearInterval(leadStopListDigestInterval);
  server.close(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
