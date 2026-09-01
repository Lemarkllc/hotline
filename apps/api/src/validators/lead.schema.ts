import { z } from "zod";
import { assignLeadSchema, convertLeadToCrmSchema, replyToLeadSchema, stopListLeadSchema } from "@hotline/shared";

export { assignLeadSchema, convertLeadToCrmSchema, replyToLeadSchema, stopListLeadSchema };

/** Фронт шлёт "to" как чистую дату ("YYYY-MM-DD"), z.coerce.date() парсит её как
 * начало дня по UTC (00:00:00.000) — со сравнением "createdAt <= to" это молча
 * отрезало весь текущий день, кроме первой секунды: реальный баг, найденный по
 * живой заявке (создана и сконвертирована сегодня, пропадала из "Переданные в CRM"
 * на десктопе из-за этой самой границы). Возвращаем конец ТОГО ЖЕ UTC-дня, что уже
 * закодирован в дате — не локальными getFullYear/getMonth/getDate (это увело бы на
 * соседний календарный день в зависимости от локального часового пояса сервера),
 * а UTC-геттерами, раз сама дата уже интерпретирована как UTC-полночь. */
function endOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

export const listLeadsQuerySchema = z.object({
  // "active" — реально в работе (NEW/IN_PROGRESS). CONVERTED — финальный статус,
  // как и STOP_LISTED, поэтому у него свой вид, а не "всё, кроме стоп-листа"
  // (см. EmailLeadRepository.list).
  view: z.enum(["active", "converted", "stop_listed"]).optional().default("active"),
  // Оба необязательные и независимые (в отличие от leadDateRangeQuerySchema ниже) —
  // список заявок должен работать и без дат вовсе (первая загрузка страницы до
  // выбора диапазона), поэтому не гейтим строгим refine на пару.
  from: z.coerce.date().optional(),
  to: z.coerce
    .date()
    .optional()
    .transform((d) => (d ? endOfUtcDay(d) : d)),
});

export const searchBitrixUsersQuerySchema = z.object({
  query: z.string().trim().max(200).default(""),
});

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Общая схема для /leads/conversion-stats и /leads/daily-stats — обе принимают тот же
// диапазон дат. Верхний предел диапазона нужен daily-stats: без него zero-filled массив
// по дням растёт без ограничений (см. EmailLeadRepository.dailyStats).
export const leadDateRangeQuerySchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date().transform(endOfUtcDay),
  })
  .refine((v) => v.from <= v.to, { message: "from должно быть раньше to" })
  .refine((v) => v.to.getTime() - v.from.getTime() <= 366 * ONE_DAY_MS, {
    message: "Диапазон не должен превышать 366 дней",
  });
