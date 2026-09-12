import nodemailer, { type Transporter } from "nodemailer";
import type { EmailLead } from "@prisma/client";
import { config } from "@/config/unifiedConfig.js";
import { logger } from "@/lib/logger.js";
import { emailLeadRepository } from "@/repositories/EmailLeadRepository.js";
import { renderLeadConfirmationHtml } from "@/templates/leadConfirmation.js";
import { renderLeadReplyHtml } from "@/templates/leadReply.js";
import { renderTemporaryPasswordHtml } from "@/templates/temporaryPassword.js";

/** Автоответ клиенту только при создании НОВОЙ заявки (PLAN.md, решение №7) — вызывается
 * из emailIngestService ровно один раз на лид, не на каждое доливаемое письмо. */
export class EmailSendService {
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter | null {
    if (!config.email.smtpUser || !config.email.smtpPassword) return null;
    this.transporter ??= nodemailer.createTransport({
      host: config.email.smtpHost,
      port: config.email.smtpPort,
      secure: config.email.smtpPort === 465,
      auth: { user: config.email.smtpUser, pass: config.email.smtpPassword },
      // Без таймаутов протухшее/зависшее TLS-соединение (пул nodemailer держит его
      // открытым между вызовами) вешает transporter.sendMail() навечно — воспроизведено
      // вживую: composer "Ответить клиенту" оставался в состоянии "отправляется"
      // бесконечно, ни ошибки, ни записи в тред. sendMail() уже обёрнут в try/catch
      // (см. вызовы ниже), поэтому таймаут корректно всплывёт как обычная ошибка отправки.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    return this.transporter;
  }

  async sendConfirmation(lead: EmailLead): Promise<void> {
    const transporter = this.getTransporter();
    if (!transporter) {
      // Креды ещё не выданы — заявка всё равно создана, просто без автоответа
      // (см. PLAN.md "Что нужно от пользователя до деплоя").
      return;
    }

    try {
      await transporter.sendMail({
        from: config.email.fromAddress,
        to: lead.fromEmail,
        subject: `Ваша заявка ${lead.publicNumber} зарегистрирована`,
        html: renderLeadConfirmationHtml(lead.publicNumber),
      });
      await emailLeadRepository.markConfirmationSent(lead.id);
    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, "emailSendService: confirmation send failed");
      await emailLeadRepository.markConfirmationError(lead.id, error instanceof Error ? error.message : String(error));
    }
  }

  /** Ответ сотрудника клиенту прямо из карточки лида (leadService.reply) — та же
   * транспортная логика, что и sendConfirmation (fromAddress, best-effort: если SMTP-креды
   * не выданы, письмо тихо не уходит, но сообщение в треде всё равно создаётся — см.
   * leadService.reply). Возвращает true/false тем же принципом, что и sendTemporaryPassword,
   * чтобы вызывающий код мог отличить "ушло" от "SMTP не настроен". */
  async sendLeadReply(lead: EmailLead, body: string, fromFullName: string): Promise<boolean> {
    const transporter = this.getTransporter();
    if (!transporter) return false;

    try {
      await transporter.sendMail({
        from: config.email.fromAddress,
        to: lead.fromEmail,
        subject: `Re: ${lead.subject}`,
        // text — фолбэк для клиентов без HTML (и для того, чтобы форвард/цитирование
        // в почтовике клиента не тянуло за собой вёрстку письма); html — основной
        // вид, фирменная оболочка Lemark (та же, что и у автоответа-подтверждения).
        text: `${body}\n\n—\n${fromFullName}`,
        html: renderLeadReplyHtml(lead.publicNumber, body, fromFullName),
      });
      return true;
    } catch (error) {
      logger.error({ err: error, leadId: lead.id }, "emailSendService: lead reply send failed");
      return false;
    }
  }

  /** Возвращает true, если письмо реально ушло — userService использует это как
   * сигнал: показать пароль администратору как резервный канал (письмо не дошло)
   * или нет (дошло, дублировать в UI не нужно). */
  async sendTemporaryPassword(toEmail: string, fullName: string, temporaryPassword: string): Promise<boolean> {
    const transporter = this.getTransporter();
    if (!transporter) return false;

    try {
      await transporter.sendMail({
        from: config.email.systemFromAddress,
        to: toEmail,
        subject: "Доступ к Lemark One",
        html: renderTemporaryPasswordHtml(fullName, temporaryPassword),
      });
      return true;
    } catch (error) {
      logger.error({ err: error, toEmail }, "emailSendService: temporary password send failed");
      return false;
    }
  }

  /** Еженедельная сводка «Рейтинг менеджеров» (weeklyManagerDigestService.ts) —
   * systemFromAddress, тем же принципом, что и sendTemporaryPassword: внутреннее
   * системное письмо, не лид-переписка от sales@. toEmails через запятую — nodemailer
   * поддерживает это нативно, отдельный цикл на каждого получателя не нужен. */
  async sendWeeklyManagerDigest(toEmails: string[], html: string): Promise<boolean> {
    const transporter = this.getTransporter();
    if (!transporter) return false;

    try {
      await transporter.sendMail({
        from: config.email.systemFromAddress,
        to: toEmails.join(", "),
        subject: "Рейтинг менеджеров — сводка за неделю",
        html,
      });
      return true;
    } catch (error) {
      logger.error({ err: error, toEmails }, "emailSendService: weekly manager digest send failed");
      return false;
    }
  }
}

export const emailSendService = new EmailSendService();
