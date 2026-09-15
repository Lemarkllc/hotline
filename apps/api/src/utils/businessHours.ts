const MS_PER_HOUR = 60 * 60 * 1000;

/** ПН-ПТ 9:00-18:00 МСК = 6:00-15:00 UTC (МСК без перевода часов, тот же принцип,
 * что и FRIDAY_SEND_HOUR_UTC в weeklyManagerDigestService.ts /
 * DIGEST_HOUR_UTC в leadAutoStopListService.ts). Праздники не учитываем — нет
 * источника данных по ним, только календарная неделя. */
const WORK_START_HOUR_UTC = 6;
const WORK_END_HOUR_UTC = 15;

function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function nextDayStart(d: Date): Date {
  const start = startOfUtcDay(d);
  start.setUTCDate(start.getUTCDate() + 1);
  return start;
}

/** Ближайший рабочий момент >= date. Вне рабочего окна (ночь/выходные) — перематывает
 * вперёд до следующего 9:00 МСК буднего дня. */
function forwardToWorkingTime(date: Date): Date {
  let d = date;
  for (;;) {
    if (isWeekend(d)) {
      d = nextDayStart(d);
      continue;
    }
    const dayStart = startOfUtcDay(d);
    const workStart = new Date(dayStart.getTime() + WORK_START_HOUR_UTC * MS_PER_HOUR);
    const workEnd = new Date(dayStart.getTime() + WORK_END_HOUR_UTC * MS_PER_HOUR);
    if (d < workStart) return workStart;
    if (d >= workEnd) {
      d = nextDayStart(d);
      continue;
    }
    return d;
  }
}

/** date попадает в рабочее окно ПН-ПТ 9:00-18:00 МСК (используется, чтобы не слать
 * пуши/письма ночью и в выходные — см. leadSlaService, bitrixLeadSlaService). */
export function isWorkingTime(date: Date): boolean {
  return forwardToWorkingTime(date).getTime() === date.getTime();
}

/** from + hours рабочих часов, пропуская ночи и выходные (SLA-дедлайн должен
 * "стоять на паузе" вне рабочего времени — решение пользователя 2026-09-15). Если
 * from сама вне рабочего окна, отсчёт стартует со следующего 9:00 МСК. */
export function addBusinessHours(from: Date, hours: number): Date {
  let cursor = forwardToWorkingTime(from);
  let remainingMs = hours * MS_PER_HOUR;
  for (;;) {
    const dayStart = startOfUtcDay(cursor);
    const workEnd = new Date(dayStart.getTime() + WORK_END_HOUR_UTC * MS_PER_HOUR);
    const availableMs = workEnd.getTime() - cursor.getTime();
    if (remainingMs <= availableMs) return new Date(cursor.getTime() + remainingMs);
    remainingMs -= availableMs;
    cursor = forwardToWorkingTime(nextDayStart(cursor));
  }
}

/** Сколько рабочих часов прошло между from и to (ночи/выходные не считаются) —
 * обратная операция к addBusinessHours, для отображения "простоя" (SlaLeadsPage). */
export function businessHoursElapsed(from: Date, to: Date): number {
  if (to <= from) return 0;
  let cursor = forwardToWorkingTime(from);
  let elapsedMs = 0;
  for (;;) {
    if (cursor >= to) break;
    const dayStart = startOfUtcDay(cursor);
    const workEnd = new Date(dayStart.getTime() + WORK_END_HOUR_UTC * MS_PER_HOUR);
    const segmentEnd = workEnd < to ? workEnd : to;
    elapsedMs += segmentEnd.getTime() - cursor.getTime();
    if (workEnd >= to) break;
    cursor = forwardToWorkingTime(nextDayStart(cursor));
  }
  return elapsedMs / MS_PER_HOUR;
}
