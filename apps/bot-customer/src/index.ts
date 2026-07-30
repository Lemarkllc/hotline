import { startNotificationPolling } from "@hotline/bot-core";
import { apiClient } from "./api.js";
import { createBot } from "./bot.js";
import { createNotificationHandler } from "./notificationHandler.js";

const bot = createBot();
const stopPolling = startNotificationPolling(apiClient, createNotificationHandler(bot));

await bot.api.setMyCommands([
  { command: "new", description: "Оставить обращение" },
  { command: "my", description: "Мои обращения" },
  { command: "privacy", description: "О конфиденциальности" },
  { command: "cancel", description: "Отменить текущее действие" },
]);

await bot.start({
  onStart: () => console.log("bot-customer запущен (long polling)"),
});

function shutdown() {
  stopPolling();
  bot.stop();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
