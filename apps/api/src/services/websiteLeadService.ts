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
  async submit(input: WebsiteLeadInput): Promise<void> {
    const lead = await emailLeadRepository.create({
      origin: "WEBSITE",
      fromEmail: input.email.toLowerCase().trim(),
      fromName: input.name ?? null,
      extractedPhone: input.phone ?? null,
      extractedEmail: null,
      subject: "Заявка с сайта lemarkllc.ru",
      originalBody: input.message?.trim() || "(без сообщения)",
      receivedAt: new Date(),
    });

    await emailSendService.sendConfirmation(lead);
    await notificationService.notifySalesNewLead(lead);
    broadcastNewLead({ id: lead.id, publicNumber: lead.publicNumber, subject: lead.subject, fromEmail: lead.fromEmail });

    const autoEnabled = await leadService.getAutoConvertSetting();
    if (!autoEnabled) {
      await notificationService.notifySalesWebsiteLeadAwaitingConversion(lead);
      return;
    }

    try {
      // mentionedManager всегда null — в отличие от письма, тут нет свободного
      // текста, в котором клиент мог бы упомянуть конкретного менеджера.
      const assignee = await pickAssignee(null);
      await leadService.autoConvertToCrm(lead.id, assignee);
      await notificationService.notifySalesLeadAutoConverted(lead, assignee.fullName);
      broadcastLeadUpdated({ id: lead.id, publicNumber: lead.publicNumber });
    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, "websiteLeadService: авто-передача в CRM упала, откат к ручному режиму");
      await notificationService.notifySalesWebsiteLeadAwaitingConversion(lead);
    }
  }
}

export const websiteLeadService = new WebsiteLeadService();
