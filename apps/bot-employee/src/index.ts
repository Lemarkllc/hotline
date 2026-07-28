import { startNotificationPolling } from "@hotline/bot-core";
import { apiClient } from "./api.js";
import { createBot } from "./bot.js";
import { createNotificationHandler } from "./notificationHandler.js";

const bot = createBot();
const stopPolling = startNotificationPolling(apiClient, createNotificationHandler(bot));

// Заполняет системное меню команд (кнопку слева от поля ввода в Telegram) — без
// setMyCommands сами команды (bot.command(...) в bot.ts) работают по ручному вводу,
// но в меню не отображаются.
await bot.api.setMyCommands([
  { command: "new", description: "Создать обращение" },
  { command: "my", description: "Мои обращения" },
  { command: "privacy", description: "О конфиденциальности" },
  { command: "cancel", description: "Отменить текущее действие" },
]);

await bot.start({
  onStart: () => console.log("bot-employee запущен (long polling)"),
});

function shutdown() {
  stopPolling();
  bot.stop();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
