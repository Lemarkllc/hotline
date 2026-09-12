import { initSentry } from "@/instrument.js";

await initSentry();

const { app } = await import("@/app.js");
const { config } = await import("@/config/unifiedConfig.js");
const { logger } = await import("@/lib/logger.js");
const { attachmentService } = await import("@/services/attachmentService.js");
const { emailIngestService } = await import("@/services/emailIngestService.js");
const { bitrixLeadSlaService } = await import("@/services/bitrixLeadSlaService.js");
const { managerLeadRatingService } = await import("@/services/managerLeadRatingService.js");
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

// «SLA Лиды» (bitrixLeadSlaService) — пороги в часах/днях, 30 минут даёт запас
// с большим отрывом, не нужно тикать чаще (см. также RE_ALERT_HOURS=24 в сервисе).
const bitrixLeadSlaInterval = setInterval(() => {
  bitrixLeadSlaService.checkStalled().catch((error) => logger.error({ err: error }, "bitrix lead SLA check failed"));
}, 30 * 60 * 1000);

// «Рейтинг менеджеров» (managerLeadRatingService) — вызов сразу при старте
// служит и разовым бэкфиллом истории (grill-me допрос 2026-09-12: с июня, не с
// момента деплоя), и первым обновлением кэша, дальше раз в сутки.
managerLeadRatingService
  .refreshSnapshots()
  .catch((error) => logger.error({ err: error }, "manager lead rating initial refresh failed"));
const managerLeadRatingInterval = setInterval(() => {
  managerLeadRatingService
    .refreshSnapshots()
    .catch((error) => logger.error({ err: error }, "manager lead rating refresh failed"));
}, 24 * 60 * 60 * 1000);

function shutdown(): void {
  clearInterval(cleanupInterval);
  clearInterval(emailPollInterval);
  clearInterval(bitrixLeadSlaInterval);
  clearInterval(managerLeadRatingInterval);
  server.close(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
