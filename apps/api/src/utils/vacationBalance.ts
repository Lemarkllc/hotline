/**
 * Формула остатка отпуска (PLAN.md §10, согласовано через /grill-me 04.09.2026).
 * Модуль ЧИСТЫЙ (без побочных эффектов, без обращений к БД/Prisma) — намеренно,
 * чтобы его можно было прогонять через Stryker Mutator (мутационные тесты,
 * см. stryker.vacationBalance.conf.json) без поднятия БД/сервера.
 *
 * Правила (зафиксированы пользователем в интервью):
 * 1. Начисление 2.33 дня за каждый "цикл" — месяц, отсчитываемый от даты-годовщины
 *    приёма на работу (hireDate), а НЕ от календарного месяца.
 * 2. Цикл засчитывается целиком, если с его начала прошло ≥15 календарных дней
 *    (правило ТК РФ про "больше половины месяца"), порог фиксированный — не
 *    пропорционален фактической длине месяца (28-31 день).
 * 3. Итоговое дробное накопление округляется ОДИН РАЗ, нестандартным правилом:
 *    дробная часть <0.6 — вниз, ≥0.6 — вверх. Округлённое целое — то, что
 *    используется и для сравнения с запрошенными днями, и для отображения.
 */

const DAYS_PER_MONTH_CYCLE = 2.33;
const CYCLE_CREDIT_THRESHOLD_DAYS = 15;
const ROUNDING_THRESHOLD = 0.6;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysInMonth(year: number, monthIndex0Based: number): number {
  // День 0 следующего месяца == последний день текущего (стандартный приём).
  return new Date(Date.UTC(year, monthIndex0Based + 1, 0)).getUTCDate();
}

/**
 * Прибавляет `months` календарных месяцев к дате, с "зажимом" дня до последнего
 * дня целевого месяца, если исходный день в нём не существует (например, приём
 * 31 января + 1 месяц -> 28/29 февраля, а не "перекат" в март, как сделал бы
 * голый `setMonth`). Тот же класс проблемы, что уже ловили в parseDate для
 * дат отпуска в боте (apps/bot-employee/src/dateInput.ts).
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const monthIndex = date.getUTCMonth();
  const year = date.getUTCFullYear();
  const totalMonths = monthIndex + months;
  const targetYear = year + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;
  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth));
  return new Date(Date.UTC(targetYear, targetMonth, clampedDay));
}

function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/**
 * Количество полных циклов (месяцев-годовщин от hireDate), засчитанных к
 * `evaluationDate` включительно. Цикл N (N=1,2,3,...) считается началом периода
 * `hireDate + N месяцев`; засчитывается, если `evaluationDate` >= (начало цикла + 15
 * дней). Цикл N всегда наступает не раньше цикла N-1, поэтому цикл прерывается
 * на первом N, где условие уже не выполняется — дальше можно не проверять.
 */
export function countEarnedCycles(hireDate: Date, evaluationDate: Date): number {
  let count = 0;
  for (let n = 1; ; n += 1) {
    const cycleStart = addMonthsClamped(hireDate, n);
    const creditDate = addDaysUtc(cycleStart, CYCLE_CREDIT_THRESHOLD_DAYS);
    if (creditDate.getTime() > evaluationDate.getTime()) break;
    count = n;
  }
  return count;
}

/** Допуск на погрешность плавающей точки: `7.6 - 7` в JS даёт `0.5999999999999996`,
 * не точное `0.6` — без эпсилона это округлилось бы вниз вопреки правилу. */
const FLOAT_EPSILON = 1e-9;

/** Нестандартное округление по требованию заказчика: <0.6 вниз, ≥0.6 вверх. */
export function roundHrBalance(value: number): number {
  const floor = Math.floor(value);
  const fraction = value - floor;
  return fraction >= ROUNDING_THRESHOLD - FLOAT_EPSILON ? floor + 1 : floor;
}

export interface VacationBalanceInput {
  /** Дата приёма на работу — якорь для циклов начисления. */
  hireDate: Date;
  /** Остаток на дату `asOfDate`, из кадровых данных (VacationBalance.startingBalance). */
  startingBalance: number;
  /** Дата, на которую известен startingBalance (VacationBalance.asOfDate). */
  asOfDate: Date;
  /** Сумма дней ОПЛАЧИВАЕМОГО отпуска (VacationRequest.paid=true), одобренного
   * (APPROVED) и приходящегося на период СТРОГО после asOfDate. */
  usedPaidDaysSinceAsOfDate: number;
  /** Дата, на которую считаем остаток — по умолчанию сейчас. */
  evaluationDate?: Date;
}

/** Итоговый доступный остаток отпуска в целых днях — см. правила округления выше. */
export function calculateAvailableVacationDays(input: VacationBalanceInput): number {
  const evaluationDate = input.evaluationDate ?? new Date();
  const earnedSinceSnapshot =
    countEarnedCycles(input.hireDate, evaluationDate) - countEarnedCycles(input.hireDate, input.asOfDate);
  const raw = input.startingBalance + DAYS_PER_MONTH_CYCLE * earnedSinceSnapshot - input.usedPaidDaysSinceAsOfDate;
  return roundHrBalance(raw);
}
