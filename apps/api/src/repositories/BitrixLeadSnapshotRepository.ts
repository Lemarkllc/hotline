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
            sourceId: lead.sourceId,
          },
          update: { assignedById: lead.assignedById, currentStatusId: lead.statusId, sourceId: lead.sourceId },
        }),
      ),
    );
  }

  /** Для страницы «Рейтинг менеджеров» — total/converted/junk на менеджера за период,
   * когорта по dateCreate (см. схему). "Провальные" — JUNK и UC_UO10VU (оба
   * SEMANTICS=failure в crm.status.list, проверено вживую 2026-09-12).
   *
   * PROCESSED ("Передано дилеру/партнёру") ИСКЛЮЧЕНА (решение пользователя,
   * 2026-09-12) — не в сделке и не провал, но раздувала бы "Не в сделке" знаменателем,
   * пока не решили отдельно, как эту категорию вообще учитывать.
   *
   * SOURCE_ID=CALL ИСКЛЮЧЁН (решение пользователя, 2026-09-13, живая проверка Павла
   * Лякишева: 45 из 50 его лидов с 1 сентября — автоматически заведённые Bitrix
   * записи на входящий звонок, 35 из них тут же JUNK/UC_UO10VU — шум телефонии, не
   * слитые сделки, раздувал "Провалено" так, будто лучший продажник — худший.
   *
   * Оба исключения — только на уровне отчёта, сам снимок в BitrixLeadSnapshot по-
   * прежнему хранит все лиды (upsertAll ничего не фильтрует) — данные не теряются. */
  async findStatsByAssignee(
    from: Date,
    to: Date,
  ): Promise<{ assignedById: string; total: number; converted: number; junk: number }[]> {
    const rows = await prisma.bitrixLeadSnapshot.groupBy({
      by: ["assignedById", "currentStatusId"],
      where: { dateCreate: { gte: from, lte: to }, currentStatusId: { not: "PROCESSED" }, sourceId: { not: "CALL" } },
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
   * DATE_TRUNC в SQL. PROCESSED/CALL исключены тем же принципом, что и
   * findStatsByAssignee выше — иначе тренд был бы так же искажён. */
  findForTrend(from: Date, to: Date): Promise<{ assignedById: string; dateCreate: Date; currentStatusId: string }[]> {
    return prisma.bitrixLeadSnapshot.findMany({
      where: { dateCreate: { gte: from, lte: to }, currentStatusId: { not: "PROCESSED" }, sourceId: { not: "CALL" } },
      select: { assignedById: true, dateCreate: true, currentStatusId: true },
    });
  }
}

export const bitrixLeadSnapshotRepository = new BitrixLeadSnapshotRepository();
