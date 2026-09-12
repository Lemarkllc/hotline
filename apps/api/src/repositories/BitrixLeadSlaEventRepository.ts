import { prisma } from "@/lib/prisma.js";

/** Append-only журнал SLA-нарушений (managerLeadRatingService.ts) — см. комментарий
 * у модели в schema.prisma. record() зовётся из bitrixLeadSlaService.checkStalled
 * ровно в момент реальной отправки алерта, никогда отдельно/задним числом. */
export class BitrixLeadSlaEventRepository {
  record(bitrixLeadId: string, statusId: string, assignedById: string): Promise<unknown> {
    return prisma.bitrixLeadSlaEvent.create({ data: { bitrixLeadId, statusId, assignedById } });
  }

  /** Для "Рейтинга менеджеров" — количество событий на менеджера за период. */
  async countByAssignee(from: Date, to: Date): Promise<Map<string, number>> {
    const rows = await prisma.bitrixLeadSlaEvent.groupBy({
      by: ["assignedById"],
      where: { occurredAt: { gte: from, lte: to } },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.assignedById, r._count._all]));
  }

  /** Для недельного тренда — все события за период, бакетинг по неделям делает
   * вызывающий сервис (managerLeadRatingService), тем же принципом, что и
   * dailyStats в EmailLeadRepository — объём не оправдывает DATE_TRUNC в SQL. */
  findInRange(from: Date, to: Date): Promise<{ assignedById: string; occurredAt: Date }[]> {
    return prisma.bitrixLeadSlaEvent.findMany({
      where: { occurredAt: { gte: from, lte: to } },
      select: { assignedById: true, occurredAt: true },
    });
  }
}

export const bitrixLeadSlaEventRepository = new BitrixLeadSlaEventRepository();
