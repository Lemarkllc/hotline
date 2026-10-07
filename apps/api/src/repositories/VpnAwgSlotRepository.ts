import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma.js";
import type { AwgSlotDecision, AwgSlotRow } from "@/utils/awgSlotChoice.js";

export class VpnAwgSlotRepository {
  /** Читает слоты профиля, спрашивает `decide`, применяет решение — всё в одной
   * транзакции. Одновременный запрос второго нового устройства упрётся в уникальный
   * индекс (P2002) — это ловит вызывающий (vpnAwgSlotService) и повторяет один раз. */
  applyDecision(
    profileId: string,
    hwidHash: string,
    decide: (rows: AwgSlotRow[]) => AwgSlotDecision,
  ): Promise<AwgSlotDecision> {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.vpnAwgSlot.findMany({
        where: { profileId },
        select: { slot: true, hwidHash: true, lastSeenAt: true },
      });
      const decision = decide(rows);
      const now = new Date();
      if (decision.kind === "reuse") {
        await tx.vpnAwgSlot.update({
          where: { profileId_hwidHash: { profileId, hwidHash } },
          data: { lastSeenAt: now },
        });
      } else if (decision.kind === "assign") {
        await tx.vpnAwgSlot.create({ data: { profileId, slot: decision.slot, hwidHash, assignedAt: now, lastSeenAt: now } });
      } else if (decision.kind === "reassign") {
        await tx.vpnAwgSlot.update({
          where: { profileId_slot: { profileId, slot: decision.slot } },
          data: { hwidHash, assignedAt: now, lastSeenAt: now },
        });
      }
      return decision;
    });
  }

  /** Слоты выше нового числа ключей (лимит устройств понизили) — освобождаются. */
  deleteAbove(profileId: string, maxSlot: number): Promise<Prisma.BatchPayload> {
    return prisma.vpnAwgSlot.deleteMany({ where: { profileId, slot: { gt: maxSlot } } });
  }

  deleteAllForProfile(profileId: string): Promise<Prisma.BatchPayload> {
    return prisma.vpnAwgSlot.deleteMany({ where: { profileId } });
  }
}

export const vpnAwgSlotRepository = new VpnAwgSlotRepository();
