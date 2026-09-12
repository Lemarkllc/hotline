import type { LeadIrrelevantCategory } from "@prisma/client";
import { config } from "@/config/unifiedConfig.js";
import { downloadObject, getPresignedDownloadUrl } from "@/lib/storage.js";
import { bitrixService, type BitrixUserDTO } from "@/services/bitrixService.js";
import { emailSendService } from "@/services/emailSendService.js";
import { auditService } from "@/services/auditService.js";
import { emailLeadRepository, type EmailLeadWithMessages } from "@/repositories/EmailLeadRepository.js";
import { emailBlocklistRepository } from "@/repositories/EmailBlocklistRepository.js";
import { systemSettingRepository } from "@/repositories/SystemSettingRepository.js";
import type { PickedAssignee } from "@/services/leadAssignmentService.js";
import type { AuthenticatedUser } from "@/types/index.js";
import { ConflictError, NotFoundError, ValidationError } from "@/types/index.js";
import { logger } from "@/lib/logger.js";

/** Ключ SystemSetting для рубильника авто-передачи релевантных лидов в CRM
 * (leadAssignmentService.ts + emailIngestService.ts) — по умолчанию включён
 * (см. getAutoConvertSetting), управляется Администратором и SALES. */
const AUTO_CONVERT_SETTING_KEY = "lead_auto_convert_enabled";

/** Рубильник авто-стоплиста нерелевантных лидов (leadAutoStopListService.ts) — в
 * отличие от AUTO_CONVERT_SETTING_KEY выше, по умолчанию ВЫКЛЮЧЕН (см.
 * getAutoStopListSetting): ложноположительный auto-convert не страшен (лишняя работа
 * на 2 минуты), а ложноотрицательный auto-stoplist — молча спрятанный реальный
 * клиент, поэтому включать нужно осознанно (grill-me допрос 2026-09-12). */
const AUTO_STOPLIST_SETTING_KEY = "lead_ai_auto_stoplist_enabled";

/** Часов на первый ответ клиенту (design_handoff_lemark_one/README.md "SLA 4 ч") —
 * фиксированная политика, не настройка: как и остальные SLA-подобные величины в этой
 * кодовой базе (см. reopenDeadlineAt у Appeal), не вынесена в SystemSetting, пока
 * не появится второй потребитель с другим значением. */
const LEAD_FIRST_RESPONSE_SLA_HOURS = 4;

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
  /** Ответственный — только снимок Bitrix24-пользователя с момента конвертации
   * (leadService.convertToCrm), не внутреннее назначение (см. схему EmailLead). */
  bitrixAssignee: { name: string; email: string | null } | null;
  bitrixLeadId: string | null;
  stopListReason: string | null;
  /** stopListedByUserId=null отличает авто-стоплист (leadService.autoStopList, нет
   * человека-актора) от ручного — тот же принцип, что и convertedByUserId=null у
   * авто-конвертации. Только для status=STOP_LISTED имеет смысл (иначе false). */
  isAiStopListed: boolean;
  aiIsRelevant: boolean | null;
  aiReasoning: string | null;
  /** Только при aiIsRelevant:false (leadAiService) — какая категория мусора и был ли
   * лид авто-стоплистнут за неё (см. stopListReason: заполняется только у категорий,
   * которые реально прогоняются через авто-стоплист). */
  irrelevantCategory: LeadIrrelevantCategory | null;
  /** SLA на первый ответ клиенту (design_handoff_lemark_one/Leads.dc.html) — не поле в
   * БД, вычисляется здесь из createdAt + LEAD_FIRST_RESPONSE_SLA_HOURS и первого
   * OUTBOUND-сообщения; просрочку (isFirstResponseOverdue) считает фронт по этим двум
   * датам плюс статусу, тем же принципом, что и Appeal (см. reopenDeadlineAt). */
  firstResponseDueAt: Date;
  firstRespondedAt: Date | null;
  messages: {
    id: string;
    fromEmail: string;
    subject: string;
    body: string;
    receivedAt: Date;
    direction: "INBOUND" | "OUTBOUND";
    sentBy: { id: string; fullName: string } | null;
    attachments: { id: string; filename: string; mimeType: string; fileSize: number }[];
  }[];
  createdAt: Date;
  updatedAt: Date;
}

function serialize(lead: EmailLeadWithMessages): LeadDTO {
  const firstOutbound = lead.messages.find((m) => m.direction === "OUTBOUND");
  return {
    id: lead.id,
    publicNumber: lead.publicNumber,
    fromEmail: lead.fromEmail,
    fromName: lead.fromName,
    extractedPhone: lead.extractedPhone,
    extractedEmail: lead.extractedEmail,
    subject: lead.subject,
    status: lead.status,
    bitrixAssignee: lead.bitrixAssigneeName
      ? { name: lead.bitrixAssigneeName, email: lead.bitrixAssigneeEmail }
      : null,
    bitrixLeadId: lead.bitrixLeadId,
    stopListReason: lead.stopListReason,
    isAiStopListed: lead.status === "STOP_LISTED" && lead.stopListedByUserId === null,
    aiIsRelevant: lead.aiIsRelevant,
    aiReasoning: lead.aiReasoning,
    irrelevantCategory: lead.irrelevantCategory,
    firstResponseDueAt: new Date(lead.createdAt.getTime() + LEAD_FIRST_RESPONSE_SLA_HOURS * 60 * 60 * 1000),
    firstRespondedAt: firstOutbound?.receivedAt ?? null,
    messages: lead.messages.map((m) => ({
      id: m.id,
      fromEmail: m.fromEmail,
      subject: m.subject,
      body: m.body,
      receivedAt: m.receivedAt,
      direction: m.direction,
      sentBy: m.sentBy ? { id: m.sentBy.id, fullName: m.sentBy.fullName } : null,
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
  async list(view: "active" | "converted" | "stop_listed", from?: Date, to?: Date): Promise<LeadDTO[]> {
    const leads = await emailLeadRepository.list(view, from, to);
    return leads.map(serialize);
  }

  async getById(id: string): Promise<LeadDTO> {
    const lead = await emailLeadRepository.findById(id);
    if (!lead) throw new NotFoundError("Заявка не найдена");
    return serialize(lead);
  }

  async getAttachmentUrl(id: string, attachmentId: string, forceDownload = false): Promise<string> {
    const lead = await emailLeadRepository.findById(id);
    if (!lead) throw new NotFoundError("Заявка не найдена");
    const attachment = lead.messages.flatMap((m) => m.attachments).find((a) => a.id === attachmentId);
    if (!attachment) throw new NotFoundError("Вложение не найдено");
    return getPresignedDownloadUrl(attachment.storageKey, { filename: attachment.filename, forceDownload });
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

  /** Вернуть заявку из стоп-листа в работу — попали туда по ошибке или обстоятельства
   * изменились (пользовательский сценарий). Снимает и статус, и блокировку адреса —
   * иначе следующее письмо с него всё равно тихо игнорировалось бы (emailIngestService). */
  async restore(id: string): Promise<LeadDTO> {
    const lead = await emailLeadRepository.findById(id);
    if (!lead) throw new NotFoundError("Заявка не найдена");
    if (lead.status !== "STOP_LISTED") throw new ConflictError("Заявка не в стоп-листе");
    await emailLeadRepository.restore(id);
    await emailBlocklistRepository.remove(lead.fromEmail);
    return this.getById(id);
  }

  /** Ответ сотрудника клиенту прямо из карточки лида — best-effort: если SMTP-креды не
   * выданы (см. emailSendService.sendLeadReply), запись в тред всё равно добавляется
   * (тот же принцип "заявка не должна оставаться без следа из-за вторичной инфраструктуры",
   * что и у forwardAttachmentsToBitrix/createCallActivity выше), но письмо клиенту не
   * уходит — вызывающий получает это через возвращаемый DTO (нет отдельного сообщения об
   * ошибке отправки, как у confirmationEmailError, т.к. точка входа интерактивная, а не
   * фоновая: пользователь видит, что письмо не появилось у клиента, и может повторить).
   */
  async reply(user: AuthenticatedUser, id: string, body: string): Promise<LeadDTO> {
    const lead = await emailLeadRepository.findById(id);
    if (!lead) throw new NotFoundError("Заявка не найдена");
    if (lead.status === "STOP_LISTED") throw new ValidationError("Заявка в стоп-листе — ответ не отправляется");
    await emailSendService.sendLeadReply(lead, body, user.fullName);
    await emailLeadRepository.addOutboundMessage(id, {
      fromEmail: config.email.fromAddress,
      subject: `Re: ${lead.subject}`,
      body,
      sentByUserId: user.id,
    });
    return this.getById(id);
  }

  async searchBitrixUsers(query: string): Promise<BitrixUserDTO[]> {
    return bitrixService.searchUsers(query);
  }

  async convertToCrm(user: AuthenticatedUser, id: string, bitrixUserId: string): Promise<LeadDTO> {
    const lead = await this.assertConvertible(id);
    const { bitrixLeadId, bitrixAssignee } = await this.performCrmConversion(lead, bitrixUserId);
    await emailLeadRepository.markConverted(id, user.id, bitrixLeadId, bitrixAssignee);
    return this.getById(id);
  }

  /**
   * Авто-передача релевантного лида (emailIngestService.ts, после leadAssignmentService.
   * pickAssignee) — та же механика конвертации, что и у ручной convertToCrm, но без
   * человека-актора: convertedByUserId=null (отличает авто- от ручной конвертации на
   * карточке), audit actorId=null (поле nullable, см. AuditEntryInput). Вызывающая
   * сторона (emailIngestService) сама ловит исключения отсюда и откатывается к
   * прежнему ручному режиму — здесь не глушим ошибку.
   */
  async autoConvertToCrm(id: string, assignee: PickedAssignee): Promise<LeadDTO> {
    const lead = await this.assertConvertible(id);
    const { bitrixLeadId, bitrixAssignee } = await this.performCrmConversion(lead, assignee.bitrixId);
    await emailLeadRepository.markConverted(id, null, bitrixLeadId, bitrixAssignee);
    await auditService.record({
      actorId: null,
      action: "lead.auto_converted",
      objectType: "EmailLead",
      objectId: id,
      result: "success",
      metadata: { bitrixUserId: assignee.bitrixId, assigneeFullName: assignee.fullName, reason: assignee.reason },
    });
    return this.getById(id);
  }

  private async assertConvertible(id: string): Promise<EmailLeadWithMessages> {
    const lead = await emailLeadRepository.findById(id);
    if (!lead) throw new NotFoundError("Заявка не найдена");
    if (lead.status === "STOP_LISTED") throw new ConflictError("Заявка в стоп-листе");
    if (lead.status === "CONVERTED") throw new ConflictError("Заявка уже передана в CRM");
    return lead;
  }

  /** Общее тело конвертации для convertToCrm/autoConvertToCrm — создание лида в
   * Bitrix, "дело" на связь, пересылка вложений, резолв снимка ответственного.
   * Не пишет ничего в нашу БД — вызывающая сторона сама решает, каким userId
   * (или null) пометить markConverted. */
  private async performCrmConversion(
    lead: EmailLeadWithMessages,
    bitrixUserId: string,
  ): Promise<{ bitrixLeadId: string; bitrixAssignee: BitrixUserDTO | null }> {
    // Вывод ИИ (режим наблюдения, leadAiService) — тем же текстом, что видит РОП на
    // карточке заявки, чтобы продажник в Bitrix, которому назначили лида, тоже видел,
    // почему его сочли релевантным, не открывая нашу систему отдельно.
    const comments =
      lead.aiReasoning != null
        ? `${lead.originalBody}\n\n---\nОценка ИИ: ${lead.aiIsRelevant ? "релевантно" : "нерелевантно"} — ${lead.aiReasoning}`
        : lead.originalBody;

    // Ошибка Bitrix не должна оставлять заявку в "наполовину сконвертированном"
    // состоянии — статус меняем только после успешного ответа CRM (PLAN.md).
    const bitrixLeadId = await bitrixService.createLead({
      title: `Заявка ${lead.publicNumber}: ${lead.subject}`,
      email: lead.fromEmail,
      secondaryEmail: lead.extractedEmail,
      phone: lead.extractedPhone,
      comments,
      assignedByUserId: bitrixUserId,
    });

    // "Дело" — созвониться в течение часа, если есть телефон; иначе написать на
    // email (реальный кейс — лид 11799: без телефона дело вообще не заводилось,
    // менеджер получал лид без единой подсказки связаться с клиентом). Email у
    // лида есть всегда (fromEmail обязателен), поэтому дело заводится в любом
    // случае. Best-effort: лид уже успешно создан выше, ошибка тут не должна
    // откатывать/блокировать уже свершившуюся передачу в CRM (тот же принцип, что
    // и у emailSendService — не роняем основной поток из-за вторичного действия).
    try {
      if (lead.extractedPhone) {
        await bitrixService.createCallActivity({
          leadId: bitrixLeadId,
          phone: lead.extractedPhone,
          responsibleUserId: bitrixUserId,
          subject: `Созвониться с клиентом по заявке ${lead.publicNumber}`,
        });
      } else {
        await bitrixService.createEmailActivity({
          leadId: bitrixLeadId,
          email: lead.fromEmail,
          responsibleUserId: bitrixUserId,
          subject: `Связаться с клиентом по email по заявке ${lead.publicNumber}`,
        });
      }
    } catch (error) {
      logger.error({ err: error, leadId: lead.id, bitrixLeadId }, "leadService: не удалось создать дело в Bitrix24");
    }

    // Вложения из писем — в таймлайн лида (best-effort, тот же принцип, что и у
    // "дела" выше: ошибка тут не должна откатывать уже успешную передачу лида).
    await this.forwardAttachmentsToBitrix(lead, bitrixLeadId);

    // Снимок имени/email ответственного для отображения на карточке (см. схему
    // EmailLead) — best-effort: сам лид в Bitrix уже корректно назначен через
    // ASSIGNED_BY_ID выше вне зависимости от того, найдётся ли здесь резолв.
    const bitrixAssignee = await bitrixService.findUserById(bitrixUserId).catch((error: unknown) => {
      logger.error(
        { err: error, leadId: lead.id, bitrixUserId },
        "leadService: не удалось резолвить имя ответственного Bitrix24",
      );
      return null;
    });

    return { bitrixLeadId, bitrixAssignee };
  }

  /** Рубильник авто-передачи (emailIngestService.ts) — по умолчанию включён (null в
   * SystemSetting трактуем как "ещё не настраивали", не как "выключено"), управляется
   * и Администратором, и SALES (см. requireAnyPlainPermission на роуте). */
  async getAutoConvertSetting(): Promise<boolean> {
    const value = await systemSettingRepository.get<boolean>(AUTO_CONVERT_SETTING_KEY);
    return value ?? true;
  }

  async setAutoConvertSetting(user: AuthenticatedUser, enabled: boolean): Promise<void> {
    await systemSettingRepository.set(AUTO_CONVERT_SETTING_KEY, enabled);
    await auditService.record({
      actorId: user.id,
      action: "lead.auto_convert_setting_changed",
      objectType: "SystemSetting",
      objectId: AUTO_CONVERT_SETTING_KEY,
      result: "success",
      metadata: { enabled },
    });
  }

  /** Рубильник авто-стоплиста (leadAutoStopListService.ts) — по умолчанию ВЫКЛЮЧЕН
   * (null трактуем как "выключено", в отличие от getAutoConvertSetting выше), см.
   * AUTO_STOPLIST_SETTING_KEY. */
  async getAutoStopListSetting(): Promise<boolean> {
    const value = await systemSettingRepository.get<boolean>(AUTO_STOPLIST_SETTING_KEY);
    return value ?? false;
  }

  async setAutoStopListSetting(user: AuthenticatedUser, enabled: boolean): Promise<void> {
    await systemSettingRepository.set(AUTO_STOPLIST_SETTING_KEY, enabled);
    await auditService.record({
      actorId: user.id,
      action: "lead.auto_stoplist_setting_changed",
      objectType: "SystemSetting",
      objectId: AUTO_STOPLIST_SETTING_KEY,
      result: "success",
      metadata: { enabled },
    });
  }

  /** Асимметричный авто-стоплист (grill-me допрос 2026-09-12) — вызывается из
   * emailIngestService только для "безопасных" категорий (SPAM/COURSE_OR_TRAINING/
   * VACANCY/SUPPLIER_PITCH), никогда для OTHER/PHISHING_ATTEMPT. userId=null на
   * stopList (нет человека-актора) — в отличие от ручного stopList() выше, НЕ
   * трогает emailBlocklistRepository: перманентная блокировка адреса — решение с
   * большими последствиями (все будущие письма молча пропадут), а не только этого
   * одного письма; риск слишком велик для полностью автоматического решения. */
  async autoStopList(id: string, category: LeadIrrelevantCategory, reasoning: string): Promise<void> {
    await emailLeadRepository.stopList(id, null, `ИИ (${category}): ${reasoning}`);
    await auditService.record({
      actorId: null,
      action: "lead.auto_stoplisted",
      objectType: "EmailLead",
      objectId: id,
      result: "success",
      metadata: { category, reasoning },
    });
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

  async conversionStats(
    from: Date,
    to: Date,
  ): Promise<{ total: number; converted: number; aiRelevant: number; conversionRate: number | null }> {
    const { total, converted, aiRelevant } = await emailLeadRepository.conversionStats(from, to);
    return { total, converted, aiRelevant, conversionRate: total > 0 ? (converted / total) * 100 : null };
  }

  async dailyStats(from: Date, to: Date): Promise<{ date: string; total: number; aiRelevant: number }[]> {
    return emailLeadRepository.dailyStats(from, to);
  }
}

export const leadService = new LeadService();
