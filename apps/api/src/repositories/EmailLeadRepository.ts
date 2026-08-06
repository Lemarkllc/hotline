import type { EmailLead, LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma.js";
import { nextSequence } from "@/utils/sequence.js";

/** «Незакрытые» статусы — повторное письмо с того же адреса доливается в заявку
 * с одним из этих статусов, а не создаёт новую (см. PLAN.md, решение №4). */
const OPEN_STATUSES: LeadStatus[] = ["NEW", "IN_PROGRESS"];

export const LEAD_DETAIL_INCLUDE = {
  messages: { orderBy: { receivedAt: "asc" as const }, include: { attachments: true } },
} satisfies Prisma.EmailLeadInclude;

export type EmailLeadWithMessages = Prisma.EmailLeadGetPayload<{ include: typeof LEAD_DETAIL_INCLUDE }>;

export interface EmailAttachmentInput {
  filename: string;
  mimeType: string;
  fileSize: number;
  /** Уже загружен в S3 к моменту вызова (см. emailIngestService) — репозиторий
   * только пишет метаданные в БД, не трогает storage. */
  storageKey: string;
}

export class EmailLeadRepository {
  /** Год фиксируется на момент создания — то же пространство нумерации, что и у
   * Appeal (utils/sequence.ts), но отдельный ключ "LEAD:{год}", не переиспользует
   * EMPLOYEE/CUSTOMER ключи Appeal. */
  async create(data: {
    fromEmail: string;
    fromName?: string | null;
    extractedPhone?: string | null;
    subject: string;
    originalBody: string;
    receivedAt: Date;
    attachments?: EmailAttachmentInput[];
  }): Promise<EmailLead> {
    const year = new Date().getUTCFullYear();
    return prisma.$transaction(async (tx) => {
      const sequence = await nextSequence(`LEAD:${year}`);
      const publicNumber = `Л-${year}-${String(sequence).padStart(5, "0")}`;

      const lead = await tx.emailLead.create({
        data: {
          publicNumber,
          fromEmail: data.fromEmail,
          fromName: data.fromName,
          extractedPhone: data.extractedPhone,
          subject: data.subject,
          originalBody: data.originalBody,
          status: "NEW",
        },
      });

      await tx.emailLeadMessage.create({
        data: {
          emailLeadId: lead.id,
          fromEmail: data.fromEmail,
          subject: data.subject,
          body: data.originalBody,
          receivedAt: data.receivedAt,
          attachments: data.attachments?.length ? { create: data.attachments } : undefined,
        },
      });

      return lead;
    });
  }

  findById(id: string): Promise<EmailLeadWithMessages | null> {
    return prisma.emailLead.findUnique({ where: { id }, include: LEAD_DETAIL_INCLUDE });
  }

  /** Есть ли уже незакрытая заявка от этого адреса — определяет, доливать письмо
   * в неё (addMessage) или create() новую (см. PLAN.md, решение №4). */
  findOpenByEmail(fromEmail: string): Promise<EmailLead | null> {
    return prisma.emailLead.findFirst({
      where: { fromEmail, status: { in: OPEN_STATUSES } },
      orderBy: { createdAt: "desc" },
    });
  }

  addMessage(
    emailLeadId: string,
    data: { fromEmail: string; subject: string; body: string; receivedAt: Date; attachments?: EmailAttachmentInput[] },
  ): Promise<unknown> {
    const { attachments, ...rest } = data;
    return prisma.emailLeadMessage.create({
      data: { emailLeadId, ...rest, attachments: attachments?.length ? { create: attachments } : undefined },
    });
  }

  list(includeStopListed: boolean): Promise<EmailLeadWithMessages[]> {
    return prisma.emailLead.findMany({
      where: includeStopListed ? { status: "STOP_LISTED" } : { status: { not: "STOP_LISTED" } },
      include: LEAD_DETAIL_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  takeInProgress(id: string): Promise<EmailLead> {
    return prisma.emailLead.update({ where: { id }, data: { status: "IN_PROGRESS" } });
  }

  stopList(id: string, userId: string, reason: string | undefined): Promise<EmailLead> {
    return prisma.emailLead.update({
      where: { id },
      data: { status: "STOP_LISTED", stopListedByUserId: userId, stopListedAt: new Date(), stopListReason: reason },
    });
  }

  markConverted(id: string, userId: string, bitrixLeadId: string): Promise<EmailLead> {
    return prisma.emailLead.update({
      where: { id },
      data: { status: "CONVERTED", convertedByUserId: userId, convertedAt: new Date(), bitrixLeadId },
    });
  }

  markConfirmationSent(id: string): Promise<EmailLead> {
    return prisma.emailLead.update({ where: { id }, data: { confirmationEmailSentAt: new Date() } });
  }

  markConfirmationError(id: string, error: string): Promise<EmailLead> {
    return prisma.emailLead.update({ where: { id }, data: { confirmationEmailError: error } });
  }

  /** Для плиток конверсии на LeadsPage — созданные в периоде, без STOP_LISTED
   * (см. PLAN.md leadService.conversionStats). */
  async conversionStats(from: Date, to: Date): Promise<{ total: number; converted: number }> {
    const [total, converted] = await Promise.all([
      prisma.emailLead.count({ where: { createdAt: { gte: from, lte: to }, status: { not: "STOP_LISTED" } } }),
      prisma.emailLead.count({ where: { createdAt: { gte: from, lte: to }, status: "CONVERTED" } }),
    ]);
    return { total, converted };
  }
}

export const emailLeadRepository = new EmailLeadRepository();
