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
    extractedEmail?: string | null;
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
          extractedEmail: data.extractedEmail,
          subject: data.subject,
          originalBody: data.originalBody,
          status: "NEW",
        },
      });

      // aiIsRelevant и т.п. НЕ пишутся здесь намеренно — на момент create() классификация
      // ещё не готова (LLM зовётся уже после создания лида, см. emailIngestService),
      // пишутся отдельным update через markAiClassification().

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

  /** "active" — реально в работе (NEW/IN_PROGRESS), не "всё, кроме стоп-листа": CONVERTED
   * тоже финальный статус, с ним уже никто не работает, поэтому не должен засорять
   * дефолтный список — та же логика, что и "Активные" у Appeal (excludeStatus CLOSED). */
  list(view: "active" | "converted" | "stop_listed", from?: Date, to?: Date): Promise<EmailLeadWithMessages[]> {
    const where: Prisma.EmailLeadWhereInput =
      view === "active"
        ? { status: { in: ["NEW", "IN_PROGRESS"] } }
        : { status: view === "converted" ? "CONVERTED" : "STOP_LISTED" };
    if (from || to) {
      where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
    }
    return prisma.emailLead.findMany({
      where,
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

  /** Обратное действие к stopList — попали туда по ошибке или обстоятельства
   * изменились (см. leadService.restore). Возвращаем в NEW (не в тот статус, что
   * был до стоп-листа — он не хранится): дальше пусть снова явно "Взять в работу",
   * тот же принцип, что и у CLOSED->IN_PROGRESS reopen у Appeal. Поля стоп-листа
   * очищаем — иначе на карточке останется неактуальная причина/дата блокировки. */
  restore(id: string): Promise<EmailLead> {
    return prisma.emailLead.update({
      where: { id },
      data: { status: "NEW", stopListedByUserId: null, stopListedAt: null, stopListReason: null },
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

  /** Режим наблюдения (leadAiService) — пишет вердикт уже ПОСЛЕ создания заявки
   * (не в create(), см. комментарий там), не блокируя отбивку/уведомление SALES. */
  markAiClassified(id: string, result: { isRelevant: boolean; reasoning: string }): Promise<EmailLead> {
    return prisma.emailLead.update({
      where: { id },
      data: { aiProcessedAt: new Date(), aiIsRelevant: result.isRelevant, aiReasoning: result.reasoning },
    });
  }

  markAiError(id: string, error: string): Promise<EmailLead> {
    return prisma.emailLead.update({ where: { id }, data: { aiProcessedAt: new Date(), aiError: error } });
  }

  /** Для плиток конверсии на LeadsPage — созданные в периоде, без STOP_LISTED
   * (см. PLAN.md leadService.conversionStats). aiRelevant — вердикт ИИ-классификации
   * (leadAiService) на момент получения письма, а не дата перевода в CRM: по
   * явному решению пользователя это более точный сигнал качества входящего потока,
   * т.к. "передано в CRM" скоро станет автоматическим и запаздывающим индикатором. */
  async conversionStats(from: Date, to: Date): Promise<{ total: number; converted: number; aiRelevant: number }> {
    const [total, converted, aiRelevant] = await Promise.all([
      prisma.emailLead.count({ where: { createdAt: { gte: from, lte: to }, status: { not: "STOP_LISTED" } } }),
      prisma.emailLead.count({ where: { createdAt: { gte: from, lte: to }, status: "CONVERTED" } }),
      prisma.emailLead.count({
        where: { createdAt: { gte: from, lte: to }, aiIsRelevant: true, status: { not: "STOP_LISTED" } },
      }),
    ]);
    return { total, converted, aiRelevant };
  }

  /** Разбивка по дням для графика "качественные лиды по дням" на LeadsPage — считаем
   * в JS, а не через SQL DATE_TRUNC: объём (email-лиды одной компании) не оправдывает
   * возню с часовым поясом в raw SQL, а бакетинг по UTC-дню тут ровно то же самое,
   * что и без усилий в JS (toISOString().slice(0,10)) — то же неявное UTC-допущение,
   * что и везде в проекте (isoDate() на ReportsPage, z.coerce.date() в валидаторах).
   * Дни без лидов зафилены нулями — иначе на графике день молча пропадает с оси,
   * а не читается как "лидов не было". */
  async dailyStats(from: Date, to: Date): Promise<{ date: string; total: number; aiRelevant: number }[]> {
    const rows = await prisma.emailLead.findMany({
      where: { createdAt: { gte: from, lte: to }, status: { not: "STOP_LISTED" } },
      select: { createdAt: true, aiIsRelevant: true },
    });

    const buckets = new Map<string, { total: number; aiRelevant: number }>();
    for (const row of rows) {
      const day = row.createdAt.toISOString().slice(0, 10);
      const bucket = buckets.get(day) ?? { total: 0, aiRelevant: 0 };
      bucket.total += 1;
      if (row.aiIsRelevant) bucket.aiRelevant += 1;
      buckets.set(day, bucket);
    }

    const result: { date: string; total: number; aiRelevant: number }[] = [];
    const cursor = new Date(from);
    cursor.setUTCHours(0, 0, 0, 0);
    const end = new Date(to);
    while (cursor <= end) {
      const day = cursor.toISOString().slice(0, 10);
      result.push({ date: day, ...(buckets.get(day) ?? { total: 0, aiRelevant: 0 }) });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return result;
  }
}

export const emailLeadRepository = new EmailLeadRepository();
