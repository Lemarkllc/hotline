import { describe, expect, it } from "vitest";
import { addBusinessHours, businessHoursElapsed, isWorkingTime } from "@/utils/businessHours.js";

// Опорная неделя: 2026-09-14 (Пн) .. 2026-09-20 (Вс).
function utc(day: number, hourUtc: number, minute = 0): Date {
  return new Date(Date.UTC(2026, 8, day, hourUtc, minute));
}

describe("isWorkingTime", () => {
  it("будни 9:00-18:00 МСК (6:00-15:00 UTC) — рабочее время", () => {
    expect(isWorkingTime(utc(14, 6))).toBe(true); // Пн 9:00 МСК
    expect(isWorkingTime(utc(14, 14, 59))).toBe(true); // Пн 17:59 МСК
  });

  it("до 9:00 и после 18:00 МСК в будни — нерабочее", () => {
    expect(isWorkingTime(utc(14, 5, 59))).toBe(false);
    expect(isWorkingTime(utc(14, 15))).toBe(false); // ровно 18:00 МСК — уже нерабочее
  });

  it("суббота и воскресенье — нерабочее в любое время", () => {
    expect(isWorkingTime(utc(19, 10))).toBe(false);
    expect(isWorkingTime(utc(20, 10))).toBe(false);
  });
});

describe("addBusinessHours", () => {
  it("укладывается в один рабочий день", () => {
    const due = addBusinessHours(utc(14, 6), 4); // Пн 9:00 + 4ч = Пн 13:00 МСК
    expect(due).toEqual(utc(14, 10));
  });

  it("лид создан вечером пятницы — дедлайн переносится на понедельник", () => {
    // Пт 17:30 МСК (14:30 UTC) + 4ч SLA: 30 мин до конца пятницы, остаток 3.5ч в Пн с 9:00
    const due = addBusinessHours(utc(18, 14, 30), 4);
    expect(due).toEqual(utc(21, 9, 30)); // Пн 12:30 МСК
  });

  it("лид создан ночью/в выходной — отсчёт стартует со следующего 9:00 МСК буднего дня", () => {
    const due = addBusinessHours(utc(19, 12), 1); // Сб днём -> Пн 9:00 + 1ч
    expect(due).toEqual(utc(21, 7));
  });

  it("SLA растягивается на несколько дней (72ч, как у IN_PROCESS)", () => {
    // Пн 9:00 МСК + 72 рабочих часа (9ч/день) = ровно 8 рабочих дней (Пн-Пт + Пн-Ср)
    const due = addBusinessHours(utc(14, 6), 72);
    expect(due).toEqual(utc(23, 15)); // Ср 23.09, 18:00 МСК
  });
});

describe("businessHoursElapsed", () => {
  it("ноль для одного и того же момента или when to < from", () => {
    expect(businessHoursElapsed(utc(14, 6), utc(14, 6))).toBe(0);
    expect(businessHoursElapsed(utc(14, 10), utc(14, 6))).toBe(0);
  });

  it("не считает выходные — лид завис в пятницу вечером, проверка в понедельник утром", () => {
    // Пт 17:00 МСК (14:00 UTC) .. Пн 10:00 МСК (7:00 UTC): 1ч пятницы + 1ч понедельника = 2ч
    const elapsed = businessHoursElapsed(utc(18, 14), utc(21, 7));
    expect(elapsed).toBe(2);
  });

  it("обратная операция к addBusinessHours", () => {
    const from = utc(15, 8); // Вт 11:00 МСК
    const to = addBusinessHours(from, 10);
    expect(businessHoursElapsed(from, to)).toBeCloseTo(10);
  });
});
