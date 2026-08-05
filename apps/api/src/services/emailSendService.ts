import nodemailer, { type Transporter } from "nodemailer";
import type { EmailLead } from "@prisma/client";
import { config } from "@/config/unifiedConfig.js";
import { logger } from "@/lib/logger.js";
import { emailLeadRepository } from "@/repositories/EmailLeadRepository.js";
import { renderLeadConfirmationHtml } from "@/templates/leadConfirmation.js";
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
        subject: "Доступ к HotLineBot",
        html: renderTemporaryPasswordHtml(fullName, temporaryPassword),
      });
      return true;
    } catch (error) {
      logger.error({ err: error, toEmail }, "emailSendService: temporary password send failed");
      return false;
    }
  }
}

export const emailSendService = new EmailSendService();
