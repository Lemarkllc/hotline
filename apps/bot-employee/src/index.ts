import { startNotificationPolling } from "@hotline/bot-core";
import { apiClient } from "./api.js";
import { createBot } from "./bot.js";
import { createNotificationHandler } from "./notificationHandler.js";

const bot = createBot();
const stopPolling = startNotificationPolling(apiClient, createNotificationHandler(bot));

await bot.start({
  onStart: () => console.log("bot-employee запущен (long polling)"),
});

function shutdown() {
  stopPolling();
  bot.stop();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
