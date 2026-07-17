import { describe, expect, it } from "vitest";
import { APPEAL_STATUSES, APPEAL_STATUS_TRANSITIONS } from "@hotline/shared";

describe("APPEAL_STATUS_TRANSITIONS (SRS §11 — жизненный цикл обращения)", () => {
  it("покрывает переходы для каждого статуса без исключений", () => {
    for (const status of APPEAL_STATUSES) {
      expect(APPEAL_STATUS_TRANSITIONS[status]).toBeDefined();
    }
  });

  it("Открыто -> На проверке — единственный разрешённый переход из OPEN", () => {
    expect(APPEAL_STATUS_TRANSITIONS.OPEN).toEqual(["UNDER_REVIEW"]);
  });

  it("Закрыто допускает только повторное открытие (-> В работе), не произвольный статус", () => {
    expect(APPEAL_STATUS_TRANSITIONS.CLOSED).toEqual(["IN_PROGRESS"]);
  });

  it("нет прямого перехода OPEN -> CLOSED в обход рассмотрения (FR-WF-003/004)", () => {
    expect(APPEAL_STATUS_TRANSITIONS.OPEN).not.toContain("CLOSED");
  });

  it("каждый переход указывает на реально существующий статус", () => {
    for (const targets of Object.values(APPEAL_STATUS_TRANSITIONS)) {
      for (const target of targets) {
        expect(APPEAL_STATUSES).toContain(target);
      }
    }
  });
});
