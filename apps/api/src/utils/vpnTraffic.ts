/** Трафик VPN за окно по суточным снимкам счётчиков панели (VpnUsageSnapshot) — чистая
 * функция. Панель хранит только накопительные up/down без истории, поэтому «за 30 дней»
 * = сумма суточных приростов. Счётчик уменьшился (перевыпуск, сброс на панели) —
 * прирост дня = новое значение: с нуля, без отрицательных сумм. */

export interface VpnUsagePoint {
  /** День снимка (полночь UTC, как @db.Date). */
  day: Date;
  /** up + down основного и всех вспомогательных клиентов, байты. */
  total: bigint;
}

export interface VpnTrafficWindow {
  bytes: bigint;
  /** Фактическая длина окна в днях: windowDays, или меньше, пока истории не хватает. */
  days: number;
  /** Начало окна; null — снимков нет. */
  since: Date | null;
  /** false — истории меньше окна («за N дней (с <дата>)»). */
  full: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDayStart(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function trafficOverWindow(points: readonly VpnUsagePoint[], windowDays: number, now: Date): VpnTrafficWindow {
  const sorted = [...points].sort((a, b) => a.day.getTime() - b.day.getTime());
  if (sorted.length === 0) return { bytes: 0n, days: 0, since: null, full: false };

  const windowStart = utcDayStart(now) - windowDays * DAY_MS;
  let bytes = 0n;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.day.getTime() <= windowStart) continue;
    const prev = sorted[i - 1]!.total;
    const cur = sorted[i]!.total;
    bytes += cur >= prev ? cur - prev : cur;
  }

  const first = sorted[0]!.day.getTime();
  if (first <= windowStart) return { bytes, days: windowDays, since: new Date(windowStart), full: true };
  const last = sorted[sorted.length - 1]!.day.getTime();
  return { bytes, days: Math.round((last - first) / DAY_MS), since: new Date(first), full: false };
}
