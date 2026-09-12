import { bitrixService } from "@/services/bitrixService.js";
import { bitrixLeadSnapshotRepository } from "@/repositories/BitrixLeadSnapshotRepository.js";
import { bitrixLeadSlaEventRepository } from "@/repositories/BitrixLeadSlaEventRepository.js";
import { SALES_ROSTER, SALES_ROSTER_KEYS } from "@/config/salesRoster.js";

const ASSIGNEE_NAME_BY_ID = new Map<string, string>(
  SALES_ROSTER_KEYS.map((k) => [SALES_ROSTER[k].bitrixId, SALES_ROSTER[k].fullName]),
);
const ROSTER_IDS = SALES_ROSTER_KEYS.map((k) => SALES_ROSTER[k].bitrixId);

export interface ManagerStatsDTO {
  assignedById: string;
  name: string;
  total: number;
  converted: number;
  junk: number;
  slaViolations: number;
  /** null, если total=0 за период — нечего делить, не 0% (0% выглядело бы как
   * "отлично", а на самом деле "данных нет"). */
  notConvertedRate: number | null;
  junkRate: number | null;
}

interface WeeklyManagerMetrics {
  slaViolations: number;
  notConvertedRate: number | null;
  junkRate: number | null;
}

export interface WeeklyTrendPointDTO {
  week: string;
  byManager: Record<string, WeeklyManagerMetrics>;
}

/** Понедельник UTC той недели, в которую попадает дата — тот же принцип "бакетинг
 * в JS, не DATE_TRUNC в SQL", что и у EmailLeadRepository.dailyStats. */
function weekStartUtc(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

/**
 * «Рейтинг менеджеров» по данным лидов (grill-me допрос 2026-09-12, lead-часть
 * будущей "фичи №2" — про Сделки пока не собираем, см. допрос по SLA-лидам). Три
 * метрики: частота SLA-нарушений (BitrixLeadSlaEvent, append-only журнал), доля не
 * переведённых в CONVERTED и доля провальных JUNK/UC_UO10VU (обе — BitrixLeadSnapshot,
 * когорта по dateCreate, вариант В допроса).
 */
export class ManagerLeadRatingService {
  /** Дёргается поллером раз в сутки (server.ts) — та же операция при первом
   * запуске делает полный бэкфилл истории с июня (никакого отдельного скрипта). */
  async refreshSnapshots(): Promise<void> {
    const leads = await bitrixService.listAllLeads(ROSTER_IDS);
    await bitrixLeadSnapshotRepository.upsertAll(leads);
  }

  async getStats(from: Date, to: Date): Promise<ManagerStatsDTO[]> {
    const [statsByAssignee, slaCounts] = await Promise.all([
      bitrixLeadSnapshotRepository.findStatsByAssignee(from, to),
      bitrixLeadSlaEventRepository.countByAssignee(from, to),
    ]);

    const byId = new Map(statsByAssignee.map((s) => [s.assignedById, s]));
    return ROSTER_IDS.map((id) => {
      const s = byId.get(id) ?? { total: 0, converted: 0, junk: 0 };
      return {
        assignedById: id,
        name: ASSIGNEE_NAME_BY_ID.get(id) ?? id,
        total: s.total,
        converted: s.converted,
        junk: s.junk,
        slaViolations: slaCounts.get(id) ?? 0,
        notConvertedRate: s.total > 0 ? ((s.total - s.converted) / s.total) * 100 : null,
        junkRate: s.total > 0 ? (s.junk / s.total) * 100 : null,
      };
    });
  }

  async getWeeklyTrend(from: Date, to: Date): Promise<WeeklyTrendPointDTO[]> {
    const [snapshotRows, eventRows] = await Promise.all([
      bitrixLeadSnapshotRepository.findForTrend(from, to),
      bitrixLeadSlaEventRepository.findInRange(from, to),
    ]);

    interface WeekBucket {
      total: Map<string, number>;
      converted: Map<string, number>;
      junk: Map<string, number>;
      slaViolations: Map<string, number>;
    }
    const weeks = new Map<string, WeekBucket>();
    const emptyBucket = (): WeekBucket => ({
      total: new Map(),
      converted: new Map(),
      junk: new Map(),
      slaViolations: new Map(),
    });
    const bump = (m: Map<string, number>, key: string) => m.set(key, (m.get(key) ?? 0) + 1);

    for (const row of snapshotRows) {
      const week = weekStartUtc(row.dateCreate);
      const bucket = weeks.get(week) ?? emptyBucket();
      bump(bucket.total, row.assignedById);
      if (row.currentStatusId === "CONVERTED") bump(bucket.converted, row.assignedById);
      if (row.currentStatusId === "JUNK" || row.currentStatusId === "UC_UO10VU") bump(bucket.junk, row.assignedById);
      weeks.set(week, bucket);
    }
    for (const row of eventRows) {
      const week = weekStartUtc(row.occurredAt);
      const bucket = weeks.get(week) ?? emptyBucket();
      bump(bucket.slaViolations, row.assignedById);
      weeks.set(week, bucket);
    }

    // Зафилены нулями недели без данных — иначе неделя молча пропадает с оси графика,
    // а не читается как "ничего не произошло" (тот же принцип, что и у dailyStats).
    const result: WeeklyTrendPointDTO[] = [];
    const cursor = new Date(weekStartUtc(from));
    const end = new Date(to);
    while (cursor <= end) {
      const week = cursor.toISOString().slice(0, 10);
      const bucket = weeks.get(week) ?? emptyBucket();
      const byManager: Record<string, WeeklyManagerMetrics> = {};
      for (const id of ROSTER_IDS) {
        const total = bucket.total.get(id) ?? 0;
        const converted = bucket.converted.get(id) ?? 0;
        const junk = bucket.junk.get(id) ?? 0;
        byManager[id] = {
          slaViolations: bucket.slaViolations.get(id) ?? 0,
          notConvertedRate: total > 0 ? ((total - converted) / total) * 100 : null,
          junkRate: total > 0 ? (junk / total) * 100 : null,
        };
      }
      result.push({ week, byManager });
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
    return result;
  }
}

export const managerLeadRatingService = new ManagerLeadRatingService();
