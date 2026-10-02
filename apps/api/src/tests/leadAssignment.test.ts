import { afterEach, describe, expect, it, vi } from "vitest";

const bitrix = vi.hoisted(() => ({ countLeadsByStatus: vi.fn() }));
vi.mock("@/services/bitrixService.js", () => ({ bitrixService: bitrix }));

import { pickAssignee } from "@/services/leadAssignmentService.js";

/** "Не обработан" по Bitrix ID: Архипова — 17, Шевчук — 89. */
function load(arkhipova: number, shevchuk: number) {
  bitrix.countLeadsByStatus.mockImplementation(async (id: string) => (id === "17" ? arkhipova : id === "89" ? shevchuk : 0));
}

describe("pickAssignee (ротация лидов, ростер с 2026-10-02)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("равная нагрузка — Архипова", async () => {
    load(3, 3);
    expect((await pickAssignee(null)).fullName).toBe("Анастасия Архипова");
  });

  it("у Шевчука меньше — Шевчук", async () => {
    load(5, 2);
    expect((await pickAssignee(null)).fullName).toBe("Александр Шевчук");
  });

  it("Архипова на пороге — Шевчук, даже если у него больше", async () => {
    load(10, 7);
    expect((await pickAssignee(null)).fullName).toBe("Александр Шевчук");
  });

  it("пара занята — случайно среди Лякишева, Пономарёвой, Беляковой; Гурьева нет", async () => {
    load(10, 12);
    const picked = new Set<string>();
    for (const r of [0, 0.4, 0.99]) {
      vi.spyOn(Math, "random").mockReturnValue(r);
      picked.add((await pickAssignee(null)).fullName);
    }
    expect([...picked].sort()).toEqual(["Наталья Белякова", "Павел Лякишев", "Татьяна Пономарёва"]);
  });

  it("упомянутый в письме менеджер — без проверки нагрузки", async () => {
    load(50, 50);
    expect((await pickAssignee("NATALIA")).bitrixId).toBe("173");
  });
});
