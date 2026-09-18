import type { Request, Response } from "express";
import type { z } from "zod";
import { BaseController } from "@/controllers/BaseController.js";
import { websiteLeadService } from "@/services/websiteLeadService.js";
import type { websiteLeadWebhookSchema } from "@/validators/websiteLead.schema.js";

export class WebsiteLeadController extends BaseController {
  /** Отвечаем сайту сразу после создания заявки (быстро, только БД) — письмо
   * клиенту, уведомления SALES и передачу в Bitrix (processAfterCreate,
   * несколько сетевых вызовов подряд) не ждём: форма на сайте не должна висеть
   * секундами из-за нашей внутренней обработки (реальная жалоба пользователя,
   * 2026-09-18). */
  async submit(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body as z.infer<typeof websiteLeadWebhookSchema>;
      const lead = await websiteLeadService.createLead(data);
      this.handleSuccess(res, { ok: true }, 201);
      void websiteLeadService.processAfterCreate(lead);
    } catch (error) {
      this.handleError(error, res, "websiteLead.submit");
    }
  }
}

export const websiteLeadController = new WebsiteLeadController();
