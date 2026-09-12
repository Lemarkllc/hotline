import { logger } from "@/lib/logger.js";
import { emailLeadRepository } from "@/repositories/EmailLeadRepository.js";
import { notificationService } from "@/services/notificationService.js";
import { LEAD_FIRST_RESPONSE_SLA_HOURS } from "@/services/leadService.js";

/** За сколько до дедлайна слать "приближается" (см. grill-me допрос с пользователем,
 * 2026-09-12) — час оставляет реальное окно на реакцию, не создавая слишком раннего шума. */
const SLA_WARNING_LEAD_HOURS = 1;

/**
 * SLA-эскалация «Заявок» (EmailLead) — до этой фичи просрочка (isOverdue, LeadsPage.tsx)
 * была видна только тому, кто сам зашёл на страницу. Поллер по аналогии с
 * emailIngestService.pollInbox: раз в интервал (server.ts) проверяет те же условия,
 * что и isOverdue() на фронте (status IN (NEW, IN_PROGRESS), нет OUTBOUND-ответа), и
 * шлёт РОП (роль SALES) ровно два разовых уведомления на лид — "приближается" и
 * "просрочено" (slaWarningSentAt/slaBreachSentAt гарантируют однократность каждого).
 *
 * Сконвертированные в CRM/стоп-лист лиды никогда сюда не попадают — ответ клиенту
 * после конвертации происходит в Bitrix, вне видимости нашей системы.
 */
export class LeadSlaService {
  async checkDeadlines(): Promise<void> {
    const now = Date.now();
    const warningThreshold = new Date(now - (LEAD_FIRST_RESPONSE_SLA_HOURS - SLA_WARNING_LEAD_HOURS) * 60 * 60 * 1000);
    const breachThreshold = new Date(now - LEAD_FIRST_RESPONSE_SLA_HOURS * 60 * 60 * 1000);

    const [warningCandidates, breachCandidates] = await Promise.all([
      emailLeadRepository.findSlaWarningCandidates(warningThreshold),
      emailLeadRepository.findSlaBreachCandidates(breachThreshold),
    ]);

    for (const lead of warningCandidates) {
      try {
        await notificationService.notifySalesLeadSlaWarning(lead);
        await emailLeadRepository.markSlaWarningSent(lead.id);
      } catch (error) {
        logger.error({ err: error, leadId: lead.id }, "leadSlaService: warning notification failed");
      }
    }

    for (const lead of breachCandidates) {
      try {
        await notificationService.notifySalesLeadSlaBreach(lead);
        await emailLeadRepository.markSlaBreachSent(lead.id);
      } catch (error) {
        logger.error({ err: error, leadId: lead.id }, "leadSlaService: breach notification failed");
      }
    }
  }
}

export const leadSlaService = new LeadSlaService();
