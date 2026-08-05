import { bitrixService, type BitrixUserDTO } from "@/services/bitrixService.js";
import { emailLeadRepository, type EmailLeadWithMessages } from "@/repositories/EmailLeadRepository.js";
import { emailBlocklistRepository } from "@/repositories/EmailBlocklistRepository.js";
import type { AuthenticatedUser } from "@/types/index.js";
import { ConflictError, NotFoundError } from "@/types/index.js";

export interface LeadDTO {
  id: string;
  publicNumber: string;
  fromEmail: string;
  fromName: string | null;
  extractedPhone: string | null;
  subject: string;
  status: string;
  bitrixLeadId: string | null;
  stopListReason: string | null;
  messages: { id: string; fromEmail: string; subject: string; body: string; receivedAt: Date }[];
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
      phone: lead.extractedPhone,
      comments: lead.originalBody,
      assignedByUserId: bitrixUserId,
    });

    await emailLeadRepository.markConverted(id, user.id, bitrixLeadId);
    return this.getById(id);
  }

  async conversionStats(from: Date, to: Date): Promise<{ total: number; converted: number; conversionRate: number | null }> {
    const { total, converted } = await emailLeadRepository.conversionStats(from, to);
    return { total, converted, conversionRate: total > 0 ? (converted / total) * 100 : null };
  }
}

export const leadService = new LeadService();
