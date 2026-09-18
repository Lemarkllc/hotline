import { logger } from "@/lib/logger.js";
import { broadcastLeadUpdated, broadcastNewLead } from "@/lib/realtime.js";
import { emailLeadRepository } from "@/repositories/EmailLeadRepository.js";
import { emailSendService } from "@/services/emailSendService.js";
import { pickAssignee } from "@/services/leadAssignmentService.js";
import { leadService } from "@/services/leadService.js";
import { notificationService } from "@/services/notificationService.js";

export interface WebsiteLeadInput {
  name?: string;
  email: string;
  phone?: string;
  message?: string;
}

/**
 * «Заявки» с сайта lemarkllc.ru (websiteLeadRoutes.ts, решение пользователя
 * 2026-09-17) — форма раньше слала лид прямо в Bitrix своим хуком, минуя нас;
 * теперь стучится сюда. Отличия от emailIngestService.ts (email-канал):
 *   1. Origin=WEBSITE, без темы/треда писем — subject синтетический.
 *   2. НЕТ шага ИИ-оценки релевантности (leadAiService) — обращение с сайта уже
 *      целевое по определению, оценивать нечего.
 *   3. Именно поэтому сразу, без ветвления на "релевантно/нет" — пикаем
 *      менеджера и передаём в CRM (при включённом рубильнике авто-передачи,
 *      том же самом, что и у email-канала).
 * Отбивка клиенту и тред заявки — общие с email-каналом (leadService/emailSendService).
 */
export class WebsiteLeadService {
  /**
   * Только создание заявки — быстро, только локальная БД, ничего по сети.
   * Контроллер отвечает сайту сразу после этого шага, не дожидаясь письма/Bitrix
   * ниже (processAfterCreate) — реальный баг, найденный пользователем 2026-09-18:
   * форма на сайте висела секундами, пока хук синхронно ждал SMTP (best-effort,
   * но само подключение может тянуться до таймаута) и несколько REST-вызовов
   * Bitrix подряд (countLeadsByStatus x2, createLead, createCallActivity/
   * createEmailActivity, findUserById) — посетитель сайта расплачивался своим
   * временем ожидания за нашу внутреннюю обработку лида.
   */
  async createLead(input: WebsiteLeadInput): Promise<{ id: string; publicNumber: string }> {
    return emailLeadRepository.create({
      origin: "WEBSITE",
      fromEmail: input.email.toLowerCase().trim(),
      fromName: input.name ?? null,
      extractedPhone: input.phone ?? null,
      extractedEmail: null,
      subject: "Заявка с сайта lemarkllc.ru",
      originalBody: input.message?.trim() || "(без сообщения)",
      receivedAt: new Date(),
    });
  }

  /** Всё, что не обязано блокировать ответ хуку сайту — отбивка клиенту,
   * уведомления SALES, авто-назначение и передача в Bitrix. Вызывается без
   * await из контроллера (fire-and-forget), поэтому сама оборачивает всё в
   * try/catch — необработанное исключение здесь иначе ушло бы как
   * unhandled rejection, а не как ответ на запрос (запроса уже нет). */
  async processAfterCreate(lead: { id: string; publicNumber: string }): Promise<void> {
    try {
      const full = await emailLeadRepository.findById(lead.id);
      if (!full) return; // не должно происходить — только что создали

      await emailSendService.sendConfirmation(full);
      await notificationService.notifySalesNewLead(full);
      broadcastNewLead({ id: full.id, publicNumber: full.publicNumber, subject: full.subject, fromEmail: full.fromEmail });

      const autoEnabled = await leadService.getAutoConvertSetting();
      if (!autoEnabled) {
        await notificationService.notifySalesWebsiteLeadAwaitingConversion(full);
        return;
      }

      try {
        // mentionedManager всегда null — в отличие от письма, тут нет свободного
        // текста, в котором клиент мог бы упомянуть конкретного менеджера.
        const assignee = await pickAssignee(null);
        await leadService.autoConvertToCrm(full.id, assignee);
        await notificationService.notifySalesLeadAutoConverted(full, assignee.fullName);
        broadcastLeadUpdated({ id: full.id, publicNumber: full.publicNumber });
      } catch (error) {
        logger.error({ err: error, leadId: full.id }, "websiteLeadService: авто-передача в CRM упала, откат к ручному режиму");
        await notificationService.notifySalesWebsiteLeadAwaitingConversion(full);
      }
    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, "websiteLeadService: обработка заявки с сайта после создания упала");
    }
  }
}

export const websiteLeadService = new WebsiteLeadService();
