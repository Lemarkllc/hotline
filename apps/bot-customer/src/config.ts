import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Отсутствует обязательная переменная окружения ${name}`);
  return value;
}

export const config = {
  // Отдельный токен от bot-employee — второй, независимо зарегистрированный Telegram-бот
  // (Фаза 7, PLAN.md §6). BOT_API_BASE_URL/BOT_SERVICE_TOKEN общие с bot-employee —
  // requireBotService(channel) на бэкенде различает боты по каналу роута, не по токену.
  telegramBotToken: required("TELEGRAM_CUSTOMER_BOT_TOKEN"),
  apiBaseUrl: process.env.BOT_API_BASE_URL ?? "http://localhost:4000/api/v1",
  botServiceToken: process.env.BOT_SERVICE_TOKEN ?? "change-me-bot-service-token",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6380",
};
