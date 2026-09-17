import type { Request, Response } from "express";
import type { z } from "zod";
import { BaseController } from "@/controllers/BaseController.js";
import { websiteLeadService } from "@/services/websiteLeadService.js";
import type { websiteLeadWebhookSchema } from "@/validators/websiteLead.schema.js";

export class WebsiteLeadController extends BaseController {
  async submit(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body as z.infer<typeof websiteLeadWebhookSchema>;
      await websiteLeadService.submit(data);
      this.handleSuccess(res, { ok: true }, 201);
    } catch (error) {
      this.handleError(error, res, "websiteLead.submit");
    }
  }
}

export const websiteLeadController = new WebsiteLeadController();
