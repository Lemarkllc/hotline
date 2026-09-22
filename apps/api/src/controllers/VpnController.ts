import type { Request, Response } from "express";
import type { z } from "zod";
import { BaseController } from "@/controllers/BaseController.js";
import { vpnService } from "@/services/vpnService.js";
import type { getVpnAccessBotSchema } from "@/validators/vpn.schema.js";

export class VpnController extends BaseController {
  /** Кнопка «Получить VPN» в боковом меню бота-сотрудника. */
  async getAccessFromBot(req: Request, res: Response): Promise<void> {
    try {
      const { telegramId } = req.query as unknown as z.infer<typeof getVpnAccessBotSchema>;
      const access = await vpnService.getAccessFromBot(BigInt(telegramId));
      this.handleSuccess(res, access);
    } catch (error) {
      this.handleError(error, res, "vpn.getAccessFromBot");
    }
  }
}

export const vpnController = new VpnController();
