import { describe, expect, it } from "vitest";
import {
  addMonthsClamped,
  calculateAvailableVacationDays,
  countEarnedCycles,
  roundHrBalance,
} from "@/utils/vacationBalance.js";

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe("addMonthsClamped", () => {
  it("прибавляет обычные месяцы без переносов", () => {
    expect(addMonthsClamped(utc(2026, 3, 15), 1)).toEqual(utc(2026, 4, 15));
    expect(addMonthsClamped(utc(2026, 3, 15), 12)).toEqual(utc(2027, 3, 15));
  });

  it("зажимает день до последнего дня месяца, если исходный день там не существует", () => {
    // 31 января + 1 месяц -> 28 февраля (2026 — невисокосный), а не 3 марта.
    expect(addMonthsClamped(utc(2026, 1, 31), 1)).toEqual(utc(2026, 2, 28));
    // 2028 — високосный: 31 января + 1 месяц -> 29 февраля.
    expect(addMonthsClamped(utc(2028, 1, 31), 1)).toEqual(utc(2028, 2, 29));
    // 31 марта + 1 месяц -> 30 апреля.
    expect(addMonthsClamped(utc(2026, 3, 31), 1)).toEqual(utc(2026, 4, 30));
  });

  it("переносит год при пересечении декабря", () => {
    expect(addMonthsClamped(utc(2026, 11, 20), 2)).toEqual(utc(2027, 1, 20));
  });
});

describe("countEarnedCycles — граница «15 дней»", () => {
  const hireDate = utc(2026, 3, 15); // цикл 1 начинается 15.04.2026

  it("не засчитывает цикл на 14-й день после начала", () => {
    // 15.04 + 14 дней = 29.04
    expect(countEarnedCycles(hireDate, utc(2026, 4, 29))).toBe(0);
  });

  it("засчитывает цикл ровно на 15-й день после начала", () => {
    // 15.04 + 15 дней = 30.04
    expect(countEarnedCycles(hireDate, utc(2026, 4, 30))).toBe(1);
  });

  it("накапливает несколько циклов подряд", () => {
    // цикл 2 начинается 15.05, +15 дней = 30.05
    expect(countEarnedCycles(hireDate, utc(2026, 5, 29))).toBe(1);
    expect(countEarnedCycles(hireDate, utc(2026, 5, 30))).toBe(2);
  });

  it("до даты приёма циклов нет", () => {
    expect(countEarnedCycles(hireDate, utc(2026, 3, 20))).toBe(0);
  });

  it("корректно работает через переход месяца с меньшим числом дней (приём 31 января)", () => {
    const jan31 = utc(2026, 1, 31);
    // цикл 1: 28.02 (зажато) + 15 дней = 15.03
    expect(countEarnedCycles(jan31, utc(2026, 3, 14))).toBe(0);
    expect(countEarnedCycles(jan31, utc(2026, 3, 15))).toBe(1);
  });
});

describe("roundHrBalance — нестандартный порог 0.6", () => {
  it("округляет вниз ниже порога, включая 0.59", () => {
    expect(roundHrBalance(7.59)).toBe(7);
    expect(roundHrBalance(7.5)).toBe(7);
    expect(roundHrBalance(7.0)).toBe(7);
  });

  it("округляет вверх начиная ровно с 0.6", () => {
    expect(roundHrBalance(7.6)).toBe(8);
    expect(roundHrBalance(7.99)).toBe(8);
  });

  it("граница чуть ниже 0.6 всё ещё округляется вниз", () => {
    expect(roundHrBalance(7.599999)).toBe(7);
  });
});

describe("calculateAvailableVacationDays", () => {
  const hireDate = utc(2024, 1, 15);

  it("возвращает startingBalance без изменений на дату asOfDate", () => {
    const result = calculateAvailableVacationDays({
      hireDate,
      startingBalance: 10,
      asOfDate: utc(2026, 9, 1),
      usedPaidDaysSinceAsOfDate: 0,
      evaluationDate: utc(2026, 9, 1),
    });
    expect(result).toBe(10);
  });

  it("прибавляет заработанные после asOfDate циклы", () => {
    // hireDate 15-е число — циклы стартуют 15-го каждого месяца, засчитываются на +15 дней (30-го/1-го).
    const result = calculateAvailableVacationDays({
      hireDate,
      startingBalance: 5,
      asOfDate: utc(2026, 9, 1), // между циклами
      usedPaidDaysSinceAsOfDate: 0,
      // Ровно через 3 полных цикла после asOfDate (15.09→30.09, 15.10→30.10, 15.11→30.11)
      evaluationDate: utc(2026, 11, 30),
    });
    // 5 + 2.33*3 = 11.99 -> округление вверх (fraction .99 >= 0.6) = 12
    expect(result).toBe(12);
  });

  it("вычитает одобренные оплачиваемые дни после asOfDate", () => {
    const result = calculateAvailableVacationDays({
      hireDate,
      startingBalance: 10,
      asOfDate: utc(2026, 9, 1),
      usedPaidDaysSinceAsOfDate: 4,
      evaluationDate: utc(2026, 9, 1),
    });
    expect(result).toBe(6);
  });

  it("не даёт задвоить накопление, случившееся до asOfDate", () => {
    // asOfDate уже "внутри" нескольких прошедших циклов — они не должны считаться повторно.
    const resultAtSnapshot = calculateAvailableVacationDays({
      hireDate,
      startingBalance: 20,
      asOfDate: utc(2026, 6, 1),
      usedPaidDaysSinceAsOfDate: 0,
      evaluationDate: utc(2026, 6, 1),
    });
    expect(resultAtSnapshot).toBe(20);
  });
});
