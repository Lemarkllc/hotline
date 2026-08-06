import { ImapFlow } from "imapflow";
import { simpleParser, type Attachment as MailAttachment } from "mailparser";
import { config } from "@/config/unifiedConfig.js";
import { logger } from "@/lib/logger.js";
import { buildLeadAttachmentStorageKey, uploadObject } from "@/lib/storage.js";
import { emailBlocklistRepository } from "@/repositories/EmailBlocklistRepository.js";
import { emailLeadRepository, type EmailAttachmentInput } from "@/repositories/EmailLeadRepository.js";
import { systemSettingRepository } from "@/repositories/SystemSettingRepository.js";
import { emailSendService } from "@/services/emailSendService.js";
import { extractNameFromSignature, extractPhone } from "@/utils/contactExtraction.js";

const MAX_ATTACHMENTS_PER_MESSAGE = 10;
const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024;

const CURSOR_KEY = "email_ingest_cursor";

interface IngestCursor {
  /** bigint не сериализуется в JSON напрямую — храним строкой. */
  uidValidity: string;
  lastUid: number;
}

/**
 * «Заявки» — читает INBOX robot@lemarkllc.ru (копии писем на sales@, см. PLAN.md),
 * заводит/дополняет EmailLead. Полностью независим от Appeal/CUSTOMER-канала.
 */
export class EmailIngestService {
  // Баг "одно письмо обрабатывается по несколько раз": setInterval в server.ts
  // вызывает pollInbox() каждые EMAIL_POLL_INTERVAL_MS НЕЗАВИСИМО от того, успел ли
  // завершиться предыдущий вызов. Если один цикл (IMAP connect + fetch + разбор +
  // запись в БД + SMTP-автоответ) занимает заметное время, следующий тик стартует
  // ПАРАЛЛЕЛЬНО — оба читают один и тот же курсор ДО того, как первый успеет его
  // продвинуть, и оба обрабатывают одни и те же UID: письмо либо дублирует историю
  // существующей заявки, либо (если та уже CONVERTED) заводит новую задним числом.
  // Этот флаг гарантирует, что в моменте выполняется не больше одного цикла.
  private isPolling = false;

  async pollInbox(): Promise<void> {
    if (this.isPolling) return;
    if (!config.email.imapUser || !config.email.imapPassword) {
      // Креды ещё не выданы (см. PLAN.md "Что нужно от пользователя до деплоя") —
      // тихо ничего не делаем, а не роняем весь API на старте без них.
      return;
    }

    this.isPolling = true;
    const client = new ImapFlow({
      host: config.email.imapHost,
      port: config.email.imapPort,
      secure: true,
      auth: { user: config.email.imapUser, pass: config.email.imapPassword },
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      try {
        await this.processMailbox(client);
      } finally {
        lock.release();
      }
      await client.logout();
    } catch (error) {
      logger.error({ err: error }, "emailIngestService: poll failed");
      try {
        await client.logout();
      } catch {
        // соединение уже могло упасть — logout() на мёртвом сокете не критичен
      }
    } finally {
      this.isPolling = false;
    }
  }

  private async processMailbox(client: ImapFlow): Promise<void> {
    const mailbox = client.mailbox;
    if (!mailbox) return;

    const cursor = await systemSettingRepository.get<IngestCursor>(CURSOR_KEY);
    const uidValidity = mailbox.uidValidity.toString();

    if (!cursor || cursor.uidValidity !== uidValidity) {
      // Первый запуск (или UIDVALIDITY сменилась, например пересоздание ящика) —
      // НЕ разбираем всё, что уже накопилось в ящике: там могут годами лежать
      // реальные письма клиентов, уже обработанные людьми вручную до включения
      // этой фичи. Заводить по ним заявки и слать "ваша заявка зарегистрирована"
      // задним числом — плохой UX для клиента и мусор в статистике. Вместо этого
      // просто запоминаем текущий "конец ящика" и со следующего цикла разбираем
      // только то, что придёт ПОСЛЕ этого момента.
      await systemSettingRepository.set(CURSOR_KEY, { uidValidity, lastUid: mailbox.uidNext - 1 });
      return;
    }

    const uids = await client.search({ uid: `${cursor.lastUid + 1}:*` }, { uid: true });
    if (!uids || uids.length === 0) return;

    for (const uid of uids.sort((a, b) => a - b)) {
      try {
        await this.processMessage(client, uid);
      } catch (error) {
        logger.error({ err: error, uid }, "emailIngestService: failed to process message");
      }
      // Курсор двигаем per-message (не батчем) — падение посреди обработки не
      // приводит к повторной обработке уже успешно заведённых писем.
      await systemSettingRepository.set(CURSOR_KEY, { uidValidity, lastUid: uid });
    }
  }

  private async processMessage(client: ImapFlow, uid: number): Promise<void> {
    const message = await client.fetchOne(String(uid), { source: true, flags: true }, { uid: true });
    if (!message || !message.source) return;
    // Второй независимый уровень защиты от повторной обработки (помимо isPolling
    // и курсора) — если письмо уже помечено \Seen, оно точно уже обработано раньше.
    if (message.flags?.has("\\Seen")) return;

    const parsed = await simpleParser(message.source);
    const fromEmail = parsed.from?.value[0]?.address?.toLowerCase().trim();
    if (!fromEmail) {
      await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
      return;
    }

    if (await emailBlocklistRepository.isBlocked(fromEmail)) {
      // Стоп-лист — письмо тихо игнорируется, заявка не создаётся и не дополняется
      // (PLAN.md, решение №6).
      await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
      return;
    }

    const fromName = parsed.from?.value[0]?.name?.trim() || null;
    const subject = parsed.subject?.trim() || "(без темы)";
    const body = (parsed.text ?? "").trim();
    const receivedAt = parsed.date ?? new Date();
    const extractedPhone = extractPhone(body);
    const extractedName = fromName ?? extractNameFromSignature(body);
    const attachments = await this.uploadAttachments(parsed.attachments);

    const existingOpenLead = await emailLeadRepository.findOpenByEmail(fromEmail);
    if (existingOpenLead) {
      await emailLeadRepository.addMessage(existingOpenLead.id, { fromEmail, subject, body, receivedAt, attachments });
    } else {
      const lead = await emailLeadRepository.create({
        fromEmail,
        fromName: extractedName,
        extractedPhone,
        subject,
        originalBody: body,
        receivedAt,
        attachments,
      });
      await emailSendService.sendConfirmation(lead);
    }

    await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
  }

  /** Best-effort — ошибка загрузки одного файла (например, слишком большой) не
   * должна ронять обработку всего письма, просто это вложение пропускается. */
  private async uploadAttachments(mailAttachments: MailAttachment[]): Promise<EmailAttachmentInput[]> {
    const result: EmailAttachmentInput[] = [];
    for (const att of mailAttachments.slice(0, MAX_ATTACHMENTS_PER_MESSAGE)) {
      if (att.size > MAX_ATTACHMENT_SIZE_BYTES) {
        logger.warn({ filename: att.filename, size: att.size }, "emailIngestService: attachment too large, skipped");
        continue;
      }
      try {
        const filename = att.filename ?? "attachment";
        const storageKey = buildLeadAttachmentStorageKey(filename);
        await uploadObject(storageKey, att.content, att.contentType);
        result.push({ filename, mimeType: att.contentType, fileSize: att.size, storageKey });
      } catch (error) {
        logger.error({ err: error, filename: att.filename }, "emailIngestService: failed to upload attachment");
      }
    }
    return result;
  }
}

export const emailIngestService = new EmailIngestService();
