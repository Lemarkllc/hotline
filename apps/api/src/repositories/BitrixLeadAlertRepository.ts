import type { BitrixLeadAlert } from "@prisma/client";
import { prisma } from "@/lib/prisma.js";

/** Дедуп/эскалация «SLA Лиды» (bitrixLeadSlaService.ts) — см. комментарий у модели
 * в schema.prisma. Ключ (bitrixLeadId, statusId), не просто bitrixLeadId: смена
 * статуса лида — новый повод для алерта, не продолжение старого. */
export class BitrixLeadAlertRepository {
  findOne(bitrixLeadId: string, statusId: string): Promise<BitrixLeadAlert | null> {
    return prisma.bitrixLeadAlert.findUnique({ where: { bitrixLeadId_statusId: { bitrixLeadId, statusId } } });
  }

  /** upsert, а не update — первый алерт по этой (лид, статус) паре ещё не имеет строки.
   * assignedById переписывается и на update — если лид переназначили другому менеджеру
   * без смены статуса, задел под будущий рейтинг должен отражать текущего, не старого. */
  touch(bitrixLeadId: string, statusId: string, assignedById: string): Promise<BitrixLeadAlert> {
    return prisma.bitrixLeadAlert.upsert({
      where: { bitrixLeadId_statusId: { bitrixLeadId, statusId } },
      create: { bitrixLeadId, statusId, assignedById },
      update: { alertedAt: new Date(), assignedById },
    });
  }
}

export const bitrixLeadAlertRepository = new BitrixLeadAlertRepository();
