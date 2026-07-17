import { initSentry } from "@/instrument.js";

await initSentry();

const { app } = await import("@/app.js");
const { config } = await import("@/config/unifiedConfig.js");
const { logger } = await import("@/lib/logger.js");
const { attachmentService } = await import("@/services/attachmentService.js");
const { ensureBucketExists } = await import("@/lib/storage.js");

await ensureBucketExists();

const server = app.listen(config.server.port, () => {
  logger.info(`HotLineBot API запущен на порту ${config.server.port}`);
});

// FR-DRF-006: черновики вложений старше 24ч удаляются из object storage.
const cleanupInterval = setInterval(() => {
  attachmentService.cleanupExpiredDrafts().catch((error) => logger.error({ err: error }, "cleanup failed"));
}, 60 * 60 * 1000);

function shutdown(): void {
  clearInterval(cleanupInterval);
  server.close(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
