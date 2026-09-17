import { z } from "zod";

/** Хук формы lemarkllc.ru (websiteLeadRoutes.ts) — email обязателен: клиенту нужна
 * та же отбивка "заявка зарегистрирована", что и по каналу EMAIL (решение
 * пользователя, 2026-09-17), без email её некому отправить. Телефон/сообщение —
 * опциональны, на сайте форма может быть только "имя + email". */
export const websiteLeadWebhookSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().email(),
  phone: z.string().trim().max(50).optional(),
  message: z.string().trim().max(5000).optional(),
});
