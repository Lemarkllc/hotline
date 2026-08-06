import { downloadObject, getPresignedDownloadUrl } from "@/lib/storage.js";
import { bitrixService, type BitrixUserDTO } from "@/services/bitrixService.js";
import { emailLeadRepository, type EmailLeadWithMessages } from "@/repositories/EmailLeadRepository.js";
import { emailBlocklistRepository } from "@/repositories/EmailBlocklistRepository.js";
import type { AuthenticatedUser } from "@/types/index.js";
import { ConflictError, NotFoundError } from "@/types/index.js";
import { logger } from "@/lib/logger.js";

/** Bitrix24 REST принимает файл как base64 прямо в JSON-теле запроса — большие
 * файлы так слать ненадёжно (может не долезть/оборваться), поэтому пересылаем
 * только то, что разумно помещается в один запрос. Сами файлы у нас в S3 всё
 * равно остаются без этого ограничения (см. MAX_ATTACHMENT_SIZE_BYTES). */
const MAX_BITRIX_FORWARD_SIZE_BYTES = 10 * 1024 * 1024;

export interface LeadDTO {
  id: string;
  publicNumber: string;
  fromEmail: string;
  fromName: string | null;
  extractedPhone: string | null;
  extractedEmail: string | null;
  subject: string;
  status: string;
  bitrixLeadId: string | null;
  stopListReason: string | null;
  messages: {
    id: string;
    fromEmail: string;
    subject: string;
    body: string;
    receivedAt: Date;
    attachments: { id: string; filename: string; mimeType: string; fileSize: number }[];
  }[];
  createdAt: Date;
  updatedAt: Date;
}

function serialize(lead: EmailLeadWithMessages): LeadDTO {
  return {
    id: lead.id,
    publicNumber: lead.publicNumber,
    fromEmail: lead.fromEmail,
    fromName: lead.fromName,
    extractedPhone: lead.extractedPhone,
    extractedEmail: lead.extractedEmail,
    subject: lead.subject,
    status: lead.status,
    bitrixLeadId: lead.bitrixLeadId,
    stopListReason: lead.stopListReason,
    messages: lead.messages.map((m) => ({
      id: m.id,
      fromEmail: m.fromEmail,
      subject: m.subject,
      body: m.body,
      receivedAt: m.receivedAt,
      attachments: m.attachments.map((a) => ({
        id: a.id,
        filename: a.filename,
        mimeType: a.mimeType,
        fileSize: a.fileSize,
      })),
    })),
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  };
}

/**
 * «Заявки» (email-лиды) — доступ проверяется на уровне роутов через
 * requirePlainPermission("lead.manage") (см. middleware/rbac.ts) — здесь, в отличие
 * от appealService, повторно право не перепроверяем: подсистема плоская, нет
 * ресурсо-специфичных нюансов (канал/назначение/конфиденциальность), которые
 * требовали бы второго слоя проверки, как у Appeal (см. CLAUDE.md "RBAC").
 */
export class LeadService {
  async list(includeStopListed: boolean): Promise<LeadDTO[]> {
    const leads = await emailLeadRepository.list(includeStopListed);
    return leads.map(serialize);
  }

  async getById(id: string): Promise<LeadDTO> {
    const lead = await emailLeadRepository.findById(id);
    if (!lead) throw new NotFoundError("Заявка не найдена");
    return serialize(lead);
  }

  async getAttachmentUrl(id: string, attachmentId: string): Promise<string> {
    const lead = await emailLeadRepository.findById(id);
    if (!lead) throw new NotFoundError("Заявка не найдена");
    const attachment = lead.messages.flatMap((m) => m.attachments).find((a) => a.id === attachmentId);
    if (!attachment) throw new NotFoundError("Вложение не найдено");
    return getPresignedDownloadUrl(attachment.storageKey);
  }

  async takeInProgress(id: string): Promise<LeadDTO> {
    const lead = await emailLeadRepository.findById(id);
    if (!lead) throw new NotFoundError("Заявка не найдена");
    if (lead.status !== "NEW") throw new ConflictError("Заявка уже в работе или закрыта");
    await emailLeadRepository.takeInProgress(id);
    return this.getById(id);
  }

  /** Стоп-лист = soft-delete: статус STOP_LISTED (пропадает из дефолтного списка и
   * статистики, но не удаляется физически) + блокировка адреса на будущее
   * (PLAN.md, решение №6). */
  async stopList(user: AuthenticatedUser, id: string, reason: string | undefined): Promise<LeadDTO> {
    const lead = await emailLeadRepository.findById(id);
    if (!lead) throw new NotFoundError("Заявка не найдена");
    if (lead.status === "CONVERTED") throw new ConflictError("Заявка уже передана в CRM");
    await emailLeadRepository.stopList(id, user.id, reason);
    await emailBlocklistRepository.add(lead.fromEmail, reason, user.id);
    return this.getById(id);
  }

  async searchBitrixUsers(query: string): Promise<BitrixUserDTO[]> {
    return bitrixService.searchUsers(query);
  }

  async convertToCrm(user: AuthenticatedUser, id: string, bitrixUserId: string): Promise<LeadDTO> {
    const lead = await emailLeadRepository.findById(id);
    if (!lead) throw new NotFoundError("Заявка не найдена");
    if (lead.status === "STOP_LISTED") throw new ConflictError("Заявка в стоп-листе");
    if (lead.status === "CONVERTED") throw new ConflictError("Заявка уже передана в CRM");

    // Ошибка Bitrix не должна оставлять заявку в "наполовину сконвертированном"
    // состоянии — статус меняем только после успешного ответа CRM (PLAN.md).
    const bitrixLeadId = await bitrixService.createLead({
      title: `Заявка ${lead.publicNumber}: ${lead.subject}`,
      email: lead.fromEmail,
      secondaryEmail: lead.extractedEmail,
      phone: lead.extractedPhone,
      comments: lead.originalBody,
      assignedByUserId: bitrixUserId,
    });

    // "Дело" — созвониться в течение часа. Best-effort: лид уже успешно создан
    // выше, ошибка тут не должна откатывать/блокировать уже свершившуюся передачу
    // в CRM (тот же принцип, что и у emailSendService — не роняем основной поток
    // из-за вторичного действия). Без телефона у звонка в Bitrix нет обязательного
    // поля COMMUNICATIONS (проверено вживую) — тогда просто не создаём дело.
    if (lead.extractedPhone) {
      try {
        await bitrixService.createCallActivity({
          leadId: bitrixLeadId,
          phone: lead.extractedPhone,
          responsibleUserId: bitrixUserId,
          subject: `Созвониться с клиентом по заявке ${lead.publicNumber}`,
        });
      } catch (error) {
        logger.error({ err: error, leadId: id, bitrixLeadId }, "leadService: не удалось создать дело в Bitrix24");
      }
    }

    // Вложения из писем — в таймлайн лида (best-effort, тот же принцип, что и у
    // "дела" выше: ошибка тут не должна откатывать уже успешную передачу лида).
    await this.forwardAttachmentsToBitrix(lead, bitrixLeadId);

    await emailLeadRepository.markConverted(id, user.id, bitrixLeadId);
    return this.getById(id);
  }

  private async forwardAttachmentsToBitrix(lead: EmailLeadWithMessages, bitrixLeadId: string): Promise<void> {
    const allAttachments = lead.messages.flatMap((m) => m.attachments);
    if (!allAttachments.length) return;

    const files: { filename: string; base64Content: string }[] = [];
    for (const a of allAttachments) {
      if (a.fileSize > MAX_BITRIX_FORWARD_SIZE_BYTES) {
        logger.warn({ leadId: lead.id, filename: a.filename, size: a.fileSize }, "leadService: вложение слишком большое для пересылки в Bitrix24, пропущено");
        continue;
      }
      try {
        const content = await downloadObject(a.storageKey);
        files.push({ filename: a.filename, base64Content: content.toString("base64") });
      } catch (error) {
        logger.error({ err: error, leadId: lead.id, filename: a.filename }, "leadService: не удалось скачать вложение для пересылки в Bitrix24");
      }
    }
    if (!files.length) return;

    try {
      await bitrixService.attachFilesToLead(
        bitrixLeadId,
        files,
        `Вложения из переписки по заявке ${lead.publicNumber}`,
      );
    } catch (error) {
      logger.error({ err: error, leadId: lead.id, bitrixLeadId }, "leadService: не удалось прикрепить вложения к лиду Bitrix24");
    }
  }

  async conversionStats(from: Date, to: Date): Promise<{ total: number; converted: number; conversionRate: number | null }> {
    const { total, converted } = await emailLeadRepository.conversionStats(from, to);
    return { total, converted, conversionRate: total > 0 ? (converted / total) * 100 : null };
  }
}

export const leadService = new LeadService();
