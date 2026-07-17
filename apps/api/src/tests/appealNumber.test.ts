import { describe, expect, it } from "vitest";
import { formatPublicNumber } from "@/utils/appealNumber.js";

describe("formatPublicNumber", () => {
  it("формирует номер по маске PREFIX-YYYY-NNNNN с ведущими нулями", () => {
    expect(formatPublicNumber("EMPLOYEE", 2026, 1)).toBe("HL-2026-00001");
    expect(formatPublicNumber("EMPLOYEE", 2026, 42)).toBe("HL-2026-00042");
    expect(formatPublicNumber("EMPLOYEE", 2026, 100000)).toBe("HL-2026-100000");
  });

  it("использует отдельный префикс для канала CUSTOMER (PLAN.md §6) — не идентифицирует автора/подразделение", () => {
    expect(formatPublicNumber("CUSTOMER", 2026, 1)).toBe("CF-2026-00001");
  });
});
