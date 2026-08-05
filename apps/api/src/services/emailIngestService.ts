import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { config } from "@/config/unifiedConfig.js";
import { logger } from "@/lib/logger.js";
import { emailBlocklistRepository } from "@/repositories/EmailBlocklistRepository.js";
import { emailLeadRepository } from "@/repositories/EmailLeadRepository.js";
import { systemSettingRepository } from "@/repositories/SystemSettingRepository.js";
import { emailSendService } from "@/services/emailSendService.js";
import { extractNameFromSignature, extractPhone } from "@/utils/contactExtraction.js";

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
  async pollInbox(): Promise<void> {
    if (!config.email.imapUser || !config.email.imapPassword) {
      // Креды ещё не выданы (см. PLAN.md "Что нужно от пользователя до деплоя") —
      // тихо ничего не делаем, а не роняем весь API на старте без них.
      return;
    }

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
    }
  }

  private async processMailbox(client: ImapFlow): Promise<void> {
    const mailbox = client.mailbox;
    if (!mailbox) return;

    const cursor = await systemSettingRepository.get<IngestCursor>(CURSOR_KEY);
    const uidValidity = mailbox.uidValidity.toString();
    // UIDVALIDITY сменилась (пересоздание ящика и т.п.) — старый курсор недействителен,
    // начинаем с начала (стандартная IMAP-практика).
    const lastUid = cursor && cursor.uidValidity === uidValidity ? cursor.lastUid : 0;

    const uids = await client.search({ uid: `${lastUid + 1}:*` }, { uid: true });
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
    const message = await client.fetchOne(String(uid), { source: true }, { uid: true });
    if (!message || !message.source) return;

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

    const existingOpenLead = await emailLeadRepository.findOpenByEmail(fromEmail);
    if (existingOpenLead) {
      await emailLeadRepository.addMessage(existingOpenLead.id, { fromEmail, subject, body, receivedAt });
    } else {
      const lead = await emailLeadRepository.create({
        fromEmail,
        fromName: extractedName,
        extractedPhone,
        subject,
        originalBody: body,
        receivedAt,
      });
      await emailSendService.sendConfirmation(lead);
    }

    await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
  }
}

export const emailIngestService = new EmailIngestService();
