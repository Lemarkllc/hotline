import { describe, expect, it } from "vitest";
import { buildPendingNotificationsWhere } from "@/utils/notificationQuery.js";

describe("buildPendingNotificationsWhere", () => {
  it("всегда фильтрует по status=PENDING", () => {
    expect(buildPendingNotificationsWhere("EMPLOYEE").status).toBe("PENDING");
    expect(buildPendingNotificationsWhere("CUSTOMER").status).toBe("PENDING");
  });

  // Ровно тот фильтр, которого не хватало в проде (07.09.2026) — WEB-уведомления
  // накапливаются без ограничения (PENDING до прочтения в UI) и без него вытесняют
  // Telegram-уведомления из выборки "N самых старых PENDING", когда их становится
  // больше лимита. Без этой проверки регрессия была бы полностью незаметна: запрос
  // не падает и не логирует ошибку, просто тихо возвращает не те строки.
  it("всегда фильтрует по channel=TELEGRAM, никогда не WEB", () => {
    expect(buildPendingNotificationsWhere("EMPLOYEE").channel).toBe("TELEGRAM");
    expect(buildPendingNotificationsWhere("CUSTOMER").channel).toBe("TELEGRAM");
  });

  it("для EMPLOYEE фильтрует по заполненному userId и не трогает externalContactId", () => {
    const where = buildPendingNotificationsWhere("EMPLOYEE");
    expect(where.userId).toEqual({ not: null });
    expect(where.externalContactId).toBeUndefined();
  });

  it("для CUSTOMER фильтрует по заполненному externalContactId и не трогает userId", () => {
    const where = buildPendingNotificationsWhere("CUSTOMER");
    expect(where.externalContactId).toEqual({ not: null });
    expect(where.userId).toBeUndefined();
  });

  it("EMPLOYEE и CUSTOMER дают взаимоисключающие условия (никогда оба поля сразу)", () => {
    const employee = buildPendingNotificationsWhere("EMPLOYEE");
    const customer = buildPendingNotificationsWhere("CUSTOMER");
    expect("externalContactId" in employee).toBe(false);
    expect("userId" in customer).toBe(false);
  });
});
