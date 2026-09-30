import { describe, expect, it } from "vitest";
import { chooseAwgSlot, type AwgSlotRow } from "@/utils/awgSlotChoice.js";

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
