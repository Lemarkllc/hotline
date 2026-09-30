/** Выбор слота AmneziaWG для устройства — чистая функция (см. vpnAwgSlotService).
 * Правило (design.md §4): своё устройство → тот же слот; иначе свободный номер;
 * иначе — слот, дольше всех не запрашивавшийся. Последний случай законен, потому что
 * вызывается только после того, как панель уже приняла это устройство под лимит —
 * значит, список устройств на панели сбросили и старые слоты фактически свободны. */

export interface AwgSlotRow {
  slot: number;
  hwidHash: string;
  lastSeenAt: Date;
}

export type AwgSlotDecision =
  | { kind: "reuse"; slot: number }
  | { kind: "assign"; slot: number }
  | { kind: "reassign"; slot: number }
  | { kind: "unavailable"; reason: string };

export function chooseAwgSlot(rows: readonly AwgSlotRow[], hwidHash: string, slotCount: number): AwgSlotDecision {
  if (slotCount < 1) return { kind: "unavailable", reason: "у профиля нет слотов AmneziaWG" };

  const own = rows.find((r) => r.hwidHash === hwidHash);
  if (own) {
    return own.slot <= slotCount
      ? { kind: "reuse", slot: own.slot }
      : { kind: "unavailable", reason: `сохранённый слот ${own.slot} вне текущего лимита ${slotCount}` };
  }

  const used = new Set(rows.map((r) => r.slot));
  for (let slot = 1; slot <= slotCount; slot++) {
    if (!used.has(slot)) return { kind: "assign", slot };
  }

  const oldest = rows
    .filter((r) => r.slot <= slotCount)
    .reduce<AwgSlotRow | null>((acc, r) => (!acc || r.lastSeenAt < acc.lastSeenAt ? r : acc), null);
  return oldest ? { kind: "reassign", slot: oldest.slot } : { kind: "unavailable", reason: "нет слота для переназначения" };
}
