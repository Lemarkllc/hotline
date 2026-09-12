import type { Request, Response } from "express";
import { BaseController } from "@/controllers/BaseController.js";
import { bitrixLeadSlaService } from "@/services/bitrixLeadSlaService.js";

export class BitrixLeadSlaController extends BaseController {
  async listStalled(_req: Request, res: Response): Promise<void> {
    try {
      const leads = await bitrixLeadSlaService.getStalledLeads();
      this.handleSuccess(res, leads);
    } catch (error) {
      this.handleError(error, res, "listStalled");
    }
  }
}

export const bitrixLeadSlaController = new BitrixLeadSlaController();
