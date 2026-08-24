import { ImapFlow } from "imapflow";
import { simpleParser, type Attachment as MailAttachment } from "mailparser";
import { htmlToText } from "html-to-text";
import { config } from "@/config/unifiedConfig.js";
import { logger } from "@/lib/logger.js";
import { buildLeadAttachmentStorageKey, uploadObject } from "@/lib/storage.js";
import { emailBlocklistRepository } from "@/repositories/EmailBlocklistRepository.js";
import { emailLeadRepository, type EmailAttachmentInput } from "@/repositories/EmailLeadRepository.js";
import { systemSettingRepository } from "@/repositories/SystemSettingRepository.js";
import { emailSendService } from "@/services/emailSendService.js";
import { leadAiService } from "@/services/leadAiService.js";
import { notificationService } from "@/services/notificationService.js";
import { broadcastLeadUpdated, broadcastNewLead } from "@/lib/realtime.js";
import {
  extractEmail,
  extractNameFromSignature,
  extractPhone,
  extractWebsiteFormContact,
} from "@/utils/contactExtraction.js";

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
    const headerFromEmail = parsed.from?.value[0]?.address?.toLowerCase().trim();
    if (!headerFromEmail) {
      await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
      return;
    }

    const subject = parsed.subject?.trim() || "(без темы)";
    // mailparser не подставляет text из html сам по себе — если письмо
    // HTML-only (нет text/plain части, частый случай для писем с оформлением
    // и вложениями), parsed.text пустой, а весь контент лежит в parsed.html.
    // Реальный кейс: Л-2026-00151 — originalBody сохранился пустым, хотя в
    // письме был текст, просто без text/plain-альтернативы.
    const plainText = parsed.text?.trim();
    const body = plainText || (parsed.html ? htmlToText(parsed.html, { wordwrap: false }).trim() : "");
    const receivedAt = parsed.date ?? new Date();

    // Уведомления формы сайта приходят на sales@ ОТ ИМЕНИ sales@ (сайт, не клиент) —
    // заголовок From в этом случае бесполезен как идентификатор клиента: если
    // оставить его как есть, ВСЕ заявки с формы сайта склеятся в один тред (fromEmail —
    // ключ группировки в findOpenByEmail), см. реальный кейс Л-2026-00086. Реальный
    // контакт в этом случае вытаскиваем из тела письма (extractWebsiteFormContact).
    const ownAddresses = new Set(
      [config.email.fromAddress, config.email.salesAddress].filter(Boolean).map((a) => a.toLowerCase()),
    );
    const isSelfAddressed = ownAddresses.has(headerFromEmail);
    const websiteForm = isSelfAddressed ? extractWebsiteFormContact(body) : null;
    const fromEmail = websiteForm?.email?.toLowerCase().trim() || headerFromEmail;

    if (isSelfAddressed && !websiteForm?.email) {
      // Самоадресованное письмо (форма сайта или другая автоматика), но реальный
      // контакт клиента извлечь не удалось — не заводим заявку "от sales@ на sales@",
      // логируем на случай, если формат письма поменяется и метки перестанут находиться.
      logger.warn({ subject }, "emailIngestService: самоадресованное письмо без извлекаемого контакта, пропущено");
      await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
      return;
    }

    if (await emailBlocklistRepository.isBlocked(fromEmail)) {
      // Стоп-лист — письмо тихо игнорируется, заявка не создаётся и не дополняется
      // (PLAN.md, решение №6).
      await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
      return;
    }

    const headerFromName = parsed.from?.value[0]?.name?.trim() || null;
    const extractedPhone = websiteForm?.phone || extractPhone(body);
    const extractedEmail = extractEmail(body, fromEmail);
    const extractedName = (isSelfAddressed ? websiteForm?.name : headerFromName) ?? extractNameFromSignature(body);
    const attachments = await this.uploadAttachments(parsed.attachments);

    const existingOpenLead = await emailLeadRepository.findOpenByEmail(fromEmail);
    if (existingOpenLead) {
      await emailLeadRepository.addMessage(existingOpenLead.id, { fromEmail, subject, body, receivedAt, attachments });
    } else {
      const lead = await emailLeadRepository.create({
        fromEmail,
        fromName: extractedName,
        extractedPhone,
        extractedEmail,
        subject,
        originalBody: body,
        receivedAt,
        attachments,
      });
      await emailSendService.sendConfirmation(lead);
      await notificationService.notifySalesNewLead(lead);
      broadcastNewLead({ id: lead.id, publicNumber: lead.publicNumber, subject: lead.subject, fromEmail: lead.fromEmail });

      // Режим наблюдения: классификация ПОСЛЕ отбивки/уведомления — медленный или
      // упавший вызов к LLM не должен задерживать то, что реально важно клиенту/SALES.
      // Поведение системы результат не меняет (см. leadAiService), только пишется на лид.
      // Ключ не задан — тихо пропускаем, не отмечая это как "ошибку" на каждой заявке.
      if (config.yandexAi.apiKey && config.yandexAi.folderId) {
        const aiResult = await leadAiService.classify({ subject, body, fromEmail });
        if (aiResult) {
          await emailLeadRepository.markAiClassified(lead.id, aiResult);
          broadcastLeadUpdated({ id: lead.id, publicNumber: lead.publicNumber });
          if (aiResult.isRelevant) {
            // Пока нет автопередачи в CRM — "релевантно" требует ручного действия
            // РОП, поэтому именно этот случай уведомляем (см. комментарий в
            // notificationService.notifySalesAiRelevantLead про разворот при автоматике).
            await notificationService.notifySalesAiRelevantLead(lead, aiResult.reasoning);
          }
        } else {
          await emailLeadRepository.markAiError(lead.id, "classify вернул null (см. логи leadAiService)");
        }
      }
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
