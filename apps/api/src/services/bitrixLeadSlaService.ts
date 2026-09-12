import { bitrixService, type BitrixActiveLeadDTO } from "@/services/bitrixService.js";
import { bitrixLeadAlertRepository } from "@/repositories/BitrixLeadAlertRepository.js";
import { notificationService } from "@/services/notificationService.js";
import { logger } from "@/lib/logger.js";
import { SALES_ROSTER, SALES_ROSTER_KEYS } from "@/config/salesRoster.js";

/** Порог "тишины" (по DATE_MODIFY, см. BitrixLeadAlert в schema.prisma) для каждого
 * активного статуса лида — grill-me допрос 2026-09-12. PROCESSED ("Передано дилеру/
 * партнёру") сознательно вне мониторинга v1 — внешний фактор, нет данных по нормальным
 * срокам. CONVERTED/JUNK/UC_UO10VU — финальные, bitrixService.listActiveLeads их и не
 * запрашивает (фильтр STATUS_ID IN [NEW, IN_PROCESS]). */
const STALE_THRESHOLD_HOURS: Record<BitrixActiveLeadDTO["statusId"], number> = {
  NEW: 4,
  IN_PROCESS: 72,
};

const STATUS_LABELS: Record<BitrixActiveLeadDTO["statusId"], string> = {
  NEW: "Не обработан",
  IN_PROCESS: "В работе",
};

/** Повтор напоминания, пока лид не сдвинулся — не разово (решение пользователя:
 * "народ ленивенький, РОП может пнуть по первому алерту, но если не сделали — он
 * должен об этом узнать"). Не чаще — иначе за недели тишины РОП утонет в уведомлениях
 * на каждый тик поллера, что убьёт доверие ко всей фиче. */
const RE_ALERT_HOURS = 24;

const ASSIGNEE_NAME_BY_ID = new Map<string, string>(
  SALES_ROSTER_KEYS.map((k) => [SALES_ROSTER[k].bitrixId, SALES_ROSTER[k].fullName]),
);

export interface StalledLeadDTO {
  id: string;
  title: string;
  statusId: BitrixActiveLeadDTO["statusId"];
  statusLabel: string;
  assignedById: string;
  assigneeName: string;
  dateModify: string;
  hoursStale: number;
  url: string;
}

/**
 * «SLA Лиды» (grill-me допрос 2026-09-12) — мониторинг зависших лидов Bitrix (не
 * сделок, это отдельная будущая фича) для 6 сотрудников SALES_ROSTER, по всем
 * каналам поступления лида. Данные всегда живые (crm.lead.list), своего снимка нет —
 * только dedup/эскалация уведомлений в BitrixLeadAlert.
 */
export class BitrixLeadSlaService {
  /** Общая точка для поллера (checkStalled) и API-эндпоинта списка (getStalledLeads) —
   * один и тот же расчёт "завис ли лид", не дублируем логику порогов. */
  private async findStalled(): Promise<StalledLeadDTO[]> {
    const assignedByIds = SALES_ROSTER_KEYS.map((k) => SALES_ROSTER[k].bitrixId);
    const leads = await bitrixService.listActiveLeads(assignedByIds);
    const now = Date.now();

    return leads
      .map((lead) => {
        const hoursStale = (now - new Date(lead.dateModify).getTime()) / (60 * 60 * 1000);
        return { lead, hoursStale };
      })
      .filter(({ lead, hoursStale }) => hoursStale > STALE_THRESHOLD_HOURS[lead.statusId])
      .map(({ lead, hoursStale }) => ({
        id: lead.id,
        title: lead.title,
        statusId: lead.statusId,
        statusLabel: STATUS_LABELS[lead.statusId],
        assignedById: lead.assignedById,
        assigneeName: ASSIGNEE_NAME_BY_ID.get(lead.assignedById) ?? lead.assignedById,
        dateModify: lead.dateModify,
        hoursStale,
        url: bitrixService.getLeadUrl(lead.id),
      }));
  }

  /** Для страницы «SLA Лиды» — просто список + агрегаты, без побочных эффектов. */
  async getStalledLeads(): Promise<StalledLeadDTO[]> {
    return this.findStalled();
  }

  /** Дёргается поллером (server.ts). Уведомляет SALES по каждому зависшему лиду, но
   * не чаще RE_ALERT_HOURS на (лид, статус) — см. bitrixLeadAlertRepository. */
  async checkStalled(): Promise<void> {
    const stalled = await this.findStalled();
    for (const lead of stalled) {
      try {
        const existing = await bitrixLeadAlertRepository.findOne(lead.id, lead.statusId);
        const dueForReAlert = !existing || Date.now() - existing.alertedAt.getTime() > RE_ALERT_HOURS * 60 * 60 * 1000;
        if (!dueForReAlert) continue;

        await notificationService.notifySalesBitrixLeadStalled(lead);
        await bitrixLeadAlertRepository.touch(lead.id, lead.statusId, lead.assignedById);
      } catch (error) {
        logger.error({ err: error, bitrixLeadId: lead.id }, "bitrixLeadSlaService: alert failed");
      }
    }
  }
}

export const bitrixLeadSlaService = new BitrixLeadSlaService();
