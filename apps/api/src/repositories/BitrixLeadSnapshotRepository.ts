import { prisma } from "@/lib/prisma.js";
import type { BitrixAnyLeadDTO } from "@/services/bitrixService.js";

/** Per-lead кэш «Рейтинга менеджеров» — см. комментарий у модели в schema.prisma
 * (вариант В из grill-me допроса 2026-09-12). */
export class BitrixLeadSnapshotRepository {
  /** Полная перезапись раз в сутки (managerLeadRatingService.refreshSnapshots) —
   * та же операция и для бэкфилла, и для ежедневного обновления, поэтому просто
   * upsert по каждому лиду, не diff. Транзакция, не $transaction([]) с сотнями
   * элементов разом — Prisma собирает их как отдельные запросы в одной транзакции,
   * при тысячах строк это нормально для ночного фонового job'а, не пользовательского
   * запроса с ограничением по времени ответа. */
  async upsertAll(leads: BitrixAnyLeadDTO[]): Promise<void> {
    await prisma.$transaction(
      leads.map((lead) =>
        prisma.bitrixLeadSnapshot.upsert({
          where: { bitrixLeadId: lead.id },
          create: {
            bitrixLeadId: lead.id,
            assignedById: lead.assignedById,
            dateCreate: new Date(lead.dateCreate),
            currentStatusId: lead.statusId,
          },
          update: { assignedById: lead.assignedById, currentStatusId: lead.statusId },
        }),
      ),
    );
  }

  /** Для страницы «Рейтинг менеджеров» — total/converted/junk на менеджера за период,
   * когорта по dateCreate (см. схему). "Провальные" — JUNK и UC_UO10VU (оба
   * SEMANTICS=failure в crm.status.list, проверено вживую 2026-09-12). */
  async findStatsByAssignee(
    from: Date,
    to: Date,
  ): Promise<{ assignedById: string; total: number; converted: number; junk: number }[]> {
    const rows = await prisma.bitrixLeadSnapshot.groupBy({
      by: ["assignedById", "currentStatusId"],
      where: { dateCreate: { gte: from, lte: to } },
      _count: { _all: true },
    });
    const byAssignee = new Map<string, { total: number; converted: number; junk: number }>();
    for (const row of rows) {
      const entry = byAssignee.get(row.assignedById) ?? { total: 0, converted: 0, junk: 0 };
      entry.total += row._count._all;
      if (row.currentStatusId === "CONVERTED") entry.converted += row._count._all;
      if (row.currentStatusId === "JUNK" || row.currentStatusId === "UC_UO10VU") entry.junk += row._count._all;
      byAssignee.set(row.assignedById, entry);
    }
    return [...byAssignee.entries()].map(([assignedById, v]) => ({ assignedById, ...v }));
  }

  /** Для недельного тренда — сырые строки, бакетинг по неделям в JS (managerLeadRatingService),
   * тем же принципом, что и EmailLeadRepository.dailyStats — объём не оправдывает
   * DATE_TRUNC в SQL. */
  findForTrend(from: Date, to: Date): Promise<{ assignedById: string; dateCreate: Date; currentStatusId: string }[]> {
    return prisma.bitrixLeadSnapshot.findMany({
      where: { dateCreate: { gte: from, lte: to } },
      select: { assignedById: true, dateCreate: true, currentStatusId: true },
    });
  }
}

export const bitrixLeadSnapshotRepository = new BitrixLeadSnapshotRepository();
