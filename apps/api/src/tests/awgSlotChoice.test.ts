import { describe, expect, it } from "vitest";
import { awgSlotCount, chooseAwgSlot, planAwgAuxSync, type AwgSlotRow } from "@/utils/awgSlotChoice.js";

const at = (minutes: number) => new Date(Date.UTC(2026, 8, 30, 12, minutes));

describe("chooseAwgSlot (слоты AmneziaWG по устройствам)", () => {
  it("первое устройство — слот 1", () => {
    expect(chooseAwgSlot([], "phone", 2)).toEqual({ kind: "assign", slot: 1 });
  });

  it("второе устройство — слот 2", () => {
    const rows: AwgSlotRow[] = [{ slot: 1, hwidHash: "phone", lastSeenAt: at(0) }];
    expect(chooseAwgSlot(rows, "laptop", 2)).toEqual({ kind: "assign", slot: 2 });
  });

  it("то же устройство — тот же слот", () => {
    const rows: AwgSlotRow[] = [
      { slot: 1, hwidHash: "phone", lastSeenAt: at(0) },
      { slot: 2, hwidHash: "laptop", lastSeenAt: at(5) },
    ];
    expect(chooseAwgSlot(rows, "laptop", 2)).toEqual({ kind: "reuse", slot: 2 });
  });

  it("освободившийся номер занимается раньше переназначения", () => {
    const rows: AwgSlotRow[] = [{ slot: 2, hwidHash: "laptop", lastSeenAt: at(5) }];
    expect(chooseAwgSlot(rows, "tablet", 2)).toEqual({ kind: "assign", slot: 1 });
  });

  it("оба заняты, панель приняла новое устройство — самый давний слот", () => {
    const rows: AwgSlotRow[] = [
      { slot: 1, hwidHash: "phone", lastSeenAt: at(30) },
      { slot: 2, hwidHash: "laptop", lastSeenAt: at(5) },
    ];
    expect(chooseAwgSlot(rows, "new-phone", 2)).toEqual({ kind: "reassign", slot: 2 });
  });

  it("сохранённый слот вне текущего лимита — недоступно", () => {
    const rows: AwgSlotRow[] = [{ slot: 2, hwidHash: "laptop", lastSeenAt: at(5) }];
    expect(chooseAwgSlot(rows, "laptop", 1).kind).toBe("unavailable");
  });

  it("нет слотов вовсе — недоступно", () => {
    expect(chooseAwgSlot([], "phone", 0).kind).toBe("unavailable");
  });
});

describe("awgSlotCount / planAwgAuxSync (ключи по лимиту устройств, до 5)", () => {
  it("число слотов = лимит в пределах 1…5", () => {
    expect(awgSlotCount(1, 5)).toBe(1);
    expect(awgSlotCount(3, 5)).toBe(3);
    expect(awgSlotCount(5, 5)).toBe(5);
    expect(awgSlotCount(8, 5)).toBe(5);
    expect(awgSlotCount(0, 5)).toBe(1);
  });

  it("лимит 1 — новое устройство при занятом слоте 1 не получает AmneziaWG", () => {
    const rows = [{ slot: 1, hwidHash: "phone", lastSeenAt: new Date(1000) }];
    expect(chooseAwgSlot(rows, "phone", awgSlotCount(1, 5))).toEqual({ kind: "reuse", slot: 1 });
  });

  it("лимит 3 — третье устройство получает слот 3", () => {
    const rows = [
      { slot: 1, hwidHash: "phone", lastSeenAt: new Date(1000) },
      { slot: 2, hwidHash: "laptop", lastSeenAt: new Date(2000) },
    ];
    expect(chooseAwgSlot(rows, "tablet", awgSlotCount(3, 5))).toEqual({ kind: "assign", slot: 3 });
  });

  it("лимит 5 — пятое устройство получает слот 5", () => {
    const rows = [1, 2, 3, 4].map((slot) => ({ slot, hwidHash: `d${slot}`, lastSeenAt: new Date(slot * 1000) }));
    expect(chooseAwgSlot(rows, "d5", awgSlotCount(5, 5))).toEqual({ kind: "assign", slot: 5 });
  });

  it("2→4: создать слоты 3 и 4", () => {
    expect(planAwgAuxSync([2], 4)).toEqual({ create: [3, 4], remove: [] });
  });

  it("4→2: удалить слоты 3 и 4", () => {
    expect(planAwgAuxSync([2, 3, 4], 2)).toEqual({ create: [], remove: [3, 4] });
  });

  it("без изменений", () => {
    expect(planAwgAuxSync([2], 2)).toEqual({ create: [], remove: [] });
  });

  it("лимит 1 — вспомогательные клиенты не нужны", () => {
    expect(planAwgAuxSync([2], 1)).toEqual({ create: [], remove: [2] });
  });
});
