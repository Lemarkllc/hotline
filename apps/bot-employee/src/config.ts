import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Отсутствует обязательная переменная окружения ${name}`);
  return value;
}

export const config = {
  telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
  apiBaseUrl: process.env.BOT_API_BASE_URL ?? "http://localhost:4000/api/v1",
  botServiceToken: process.env.BOT_SERVICE_TOKEN ?? "change-me-bot-service-token",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6380",
  // Общий и производственный чаты сотрудников — при увольнении (исход "Уволить")
  // бот удаляет сотрудника из обоих (см. notificationHandler.ts "employee_terminated").
  // Бот должен быть добавлен в оба чата администратором с правом "Блокировка
  // пользователей" — сам себя добавить/повысить он не может.
  terminationRemovalChatIds: (process.env.TERMINATION_REMOVAL_CHAT_IDS ?? "-1003386177772,-1003674354103")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
};
