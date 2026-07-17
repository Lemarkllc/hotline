import type { Request, Response } from "express";
import { BaseController } from "@/controllers/BaseController.js";
import { notificationService } from "@/services/notificationService.js";
import { pathParam } from "@/utils/params.js";

export class NotificationController extends BaseController {
  /** Поллинг ботом (TELEGRAM-канал) — доставляет и сам подтверждает через /ack. */
  async pendingForBot(req: Request, res: Response): Promise<void> {
    try {
      const items = await notificationService.listPendingForBot("TELEGRAM");
      this.handleSuccess(res, items);
    } catch (error) {
      this.handleError(error, res, "pendingForBot");
    }
  }

  async ack(req: Request, res: Response): Promise<void> {
    try {
      await notificationService.ack(pathParam(req, "id"));
      this.handleSuccess(res, { ok: true });
    } catch (error) {
      this.handleError(error, res, "ack");
    }
  }

  async listForWebUser(req: Request, res: Response): Promise<void> {
    try {
      const onlyUnread = req.query.unread === "true";
      const items = await notificationService.listForWebUser(req.user!.id, onlyUnread);
      this.handleSuccess(res, items);
    } catch (error) {
      this.handleError(error, res, "listForWebUser");
    }
  }

  async markRead(req: Request, res: Response): Promise<void> {
    try {
      await notificationService.markRead(pathParam(req, "id"));
      this.handleSuccess(res, { ok: true });
    } catch (error) {
      this.handleError(error, res, "markRead");
    }
  }
}

export const notificationController = new NotificationController();
