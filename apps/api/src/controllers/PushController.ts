import type { Request, Response } from "express";
import { BaseController } from "@/controllers/BaseController.js";
import { pushService } from "@/services/pushService.js";
import { config } from "@/config/unifiedConfig.js";

export class PushController extends BaseController {
  async publicKey(_req: Request, res: Response): Promise<void> {
    try {
      this.handleSuccess(res, { publicKey: config.webPush.vapidPublicKey });
    } catch (error) {
      this.handleError(error, res, "publicKey");
    }
  }

  async subscribe(req: Request, res: Response): Promise<void> {
    try {
      const { endpoint, keys } = req.body as { endpoint: string; keys: { p256dh: string; auth: string } };
      await pushService.subscribe(req.user!.id, endpoint, keys.p256dh, keys.auth);
      this.handleSuccess(res, { ok: true });
    } catch (error) {
      this.handleError(error, res, "subscribe");
    }
  }

  async unsubscribe(req: Request, res: Response): Promise<void> {
    try {
      const { endpoint } = req.body as { endpoint: string };
      await pushService.unsubscribe(endpoint);
      this.handleSuccess(res, { ok: true });
    } catch (error) {
      this.handleError(error, res, "unsubscribe");
    }
  }
}

export const pushController = new PushController();
