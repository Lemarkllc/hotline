import { describe, expect, it } from "vitest";
import { trafficOverWindow, type VpnUsagePoint } from "@/utils/vpnTraffic.js";

const GB = 1024n ** 3n;
const NOW = new Date("2026-10-31T05:00:00Z");
const day = (offset: number) => new Date(Date.UTC(2026, 9, 31 + offset));

/** Снимки с дня `from` по сегодня (offset 0), значение = f(offset). */
function series(from: number, f: (offset: number) => bigint): VpnUsagePoint[] {
  const out: VpnUsagePoint[] = [];
  for (let o = from; o <= 0; o++) out.push({ day: day(o), total: f(o) });
  return out;
}

describe("trafficOverWindow (трафик за 30 дней по снимкам)", () => {
  it("рост 1 ГБ в сутки весь месяц — 30 ГБ", () => {
    const r = trafficOverWindow(series(-40, (o) => BigInt(o + 40) * GB), 30, NOW);
    expect(r.bytes).toBe(30n * GB);
    expect(r.full).toBe(true);
    expect(r.days).toBe(30);
  });

  it("счётчик упал (перевыпуск) — день считается с нового значения", () => {
    // До дня -10 копится 100 ГБ + 1 ГБ/день, в день -10 сброс до 1 ГБ, дальше снова +1 ГБ/день.
    const r = trafficOverWindow(series(-40, (o) => (o < -10 ? 100n * GB + BigInt(o + 40) * GB : BigInt(o + 11) * GB)), 30, NOW);
    expect(r.bytes).toBe(30n * GB);
  });

  it("мало истории — 7 дней с даты первого снимка", () => {
    const r = trafficOverWindow(series(-7, (o) => BigInt(o + 7) * GB), 30, NOW);
    expect(r).toEqual({ bytes: 7n * GB, days: 7, since: day(-7), full: false });
  });

  it("один снимок — прироста нет", () => {
    expect(trafficOverWindow([{ day: day(0), total: 5n * GB }], 30, NOW)).toEqual({ bytes: 0n, days: 0, since: day(0), full: false });
  });

  it("нет снимков", () => {
    expect(trafficOverWindow([], 30, NOW)).toEqual({ bytes: 0n, days: 0, since: null, full: false });
  });

  it("пропуски дней не теряют трафик — прирост между снимками целиком", () => {
    const points = [
      { day: day(-35), total: 0n },
      { day: day(-20), total: 10n * GB },
      { day: day(0), total: 15n * GB },
    ];
    // Прирост с -35 по -20 попадает в окно (день снимка -20 внутри последних 30 дней).
    expect(trafficOverWindow(points, 30, NOW).bytes).toBe(15n * GB);
  });
});
