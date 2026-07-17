import type { Request, Response } from "express";
import { BaseController } from "@/controllers/BaseController.js";
import { auditService } from "@/services/auditService.js";
import { ForbiddenError } from "@/types/index.js";

export class AuditController extends BaseController {
  async list(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user!.permissions.includes("audit.read")) {
        throw new ForbiddenError("Недостаточно прав для просмотра аудита");
      }
      const { action, actorId, appealId, page, pageSize } = req.query as {
        action?: string;
        actorId?: string;
        appealId?: string;
        page?: string;
        pageSize?: string;
      };
      const items = await auditService.list(
        { action, actorId, appealId },
        page ? Number(page) : 1,
        pageSize ? Number(pageSize) : 50,
      );
      this.handleSuccess(res, items);
    } catch (error) {
      this.handleError(error, res, "list");
    }
  }
}

export const auditController = new AuditController();
