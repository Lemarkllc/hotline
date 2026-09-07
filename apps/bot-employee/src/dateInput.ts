export const DATE_FORMAT_HINT = "в формате ДД.ММ.ГГГГ, например 15.09.2026";

/** ДД.ММ.ГГГГ — в проекте нет инлайн-календаря и не подключён (@grammyjs/calendar
 * не в зависимостях) — сбор дат текстом с валидацией достаточен для v1, ради этого
 * не добавляем новую зависимость. new Date(Date.UTC(...)) + сверка компонентов назад —
 * ловит "укатившиеся" даты вроде 31.02, которые JS Date иначе тихо перекатывает в март.
 * Общий модуль — переиспользуется conversations/vacation.ts и conversations/timeOff.ts. */
export function parseDate(text: string): Date | null {
  const match = text.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("ru-RU", { timeZone: "UTC" });
}
