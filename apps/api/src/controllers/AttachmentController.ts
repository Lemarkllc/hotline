import type { Request, Response } from "express";
import { BaseController } from "@/controllers/BaseController.js";
import { attachmentService } from "@/services/attachmentService.js";
import { ValidationError } from "@/types/index.js";
import { pathParam } from "@/utils/params.js";

export class AttachmentController extends BaseController {
  async uploadDraft(req: Request, res: Response): Promise<void> {
    try {
      const file = (req as Request & { file?: Express.Multer.File }).file;
      if (!file) throw new ValidationError("Файл обязателен");
      const { telegramId } = req.body as { telegramId: string };
      const result = await attachmentService.uploadDraft({
        telegramId: BigInt(telegramId),
        buffer: file.buffer,
        mimeType: file.mimetype,
        originalName: file.originalname,
      });
      this.handleSuccess(res, result, 201);
    } catch (error) {
      this.handleError(error, res, "uploadDraft");
    }
  }

  async removeDraft(req: Request, res: Response): Promise<void> {
    try {
      const { telegramId } = req.body as { telegramId: string };
      await attachmentService.removeDraft(BigInt(telegramId), pathParam(req, "id"));
      this.handleSuccess(res, { ok: true });
    } catch (error) {
      this.handleError(error, res, "removeDraft");
    }
  }
}

export const attachmentController = new AttachmentController();
