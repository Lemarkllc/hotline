import type { Request, Response } from "express";
import type { z } from "zod";
import { BaseController } from "@/controllers/BaseController.js";
import { appealService } from "@/services/appealService.js";
import { pathParam } from "@/utils/params.js";
import type {
  changeStatusSchema,
  createAppealBotSchema,
  listAppealsQuerySchema,
  myAppealsQuerySchema,
} from "@/validators/appeal.schema.js";

export class AppealController extends BaseController {
  /** Бот сотрудников создаёт обращение от имени telegramId (FR-APP-001..010). */
  async createFromBot(req: Request, res: Response): Promise<void> {
    try {
      const { telegramId, type, mode, originalText, attachmentIds } = req.body as z.infer<
        typeof createAppealBotSchema
      >;
      const appeal = await appealService.createEmployeeAppeal({
        telegramId: BigInt(telegramId),
        type,
        mode,
        originalText,
        attachmentIds,
      });
      this.handleSuccess(res, { id: appeal.id, publicNumber: appeal.publicNumber }, 201);
    } catch (error) {
      this.handleError(error, res, "createFromBot");
    }
  }

  async listMentionable(req: Request, res: Response): Promise<void> {
    try {
      const users = await appealService.listMentionable(req.user!, pathParam(req, "id"));
      this.handleSuccess(res, users);
    } catch (error) {
      this.handleError(error, res, "listMentionable");
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const dto = await appealService.getByIdForStaff(req.user!, pathParam(req, "id"));
      this.handleSuccess(res, dto);
    } catch (error) {
      this.handleError(error, res, "getById");
    }
  }

  async revealAuthor(req: Request, res: Response): Promise<void> {
    try {
      const { password } = req.body as { password: string };
      const author = await appealService.revealAuthor(req.user!, pathParam(req, "id"), password);
      this.handleSuccess(res, author);
    } catch (error) {
      this.handleError(error, res, "revealAuthor");
    }
  }

  async getMineDetailFromBot(req: Request, res: Response): Promise<void> {
    try {
      const { telegramId } = req.query as { telegramId: string };
      const dto = await appealService.getByIdForAuthor(BigInt(telegramId), pathParam(req, "id"));
      this.handleSuccess(res, dto);
    } catch (error) {
      this.handleError(error, res, "getMineDetailFromBot");
    }
  }

  async list(req: Request, res: Response): Promise<void> {
    try {
      const q = req.query as unknown as z.infer<typeof listAppealsQuerySchema>;
      const result = await appealService.list(req.user!, q);
      this.handleSuccess(res, result);
    } catch (error) {
      this.handleError(error, res, "list");
    }
  }

  async listMineFromBot(req: Request, res: Response): Promise<void> {
    try {
      const { telegramId, page, pageSize, bucket } = req.query as unknown as z.infer<
        typeof myAppealsQuerySchema
      >;
      const result = await appealService.listMineForAuthor(BigInt(telegramId), page, pageSize, bucket);
      this.handleSuccess(res, result);
    } catch (error) {
      this.handleError(error, res, "listMineFromBot");
    }
  }

  async changeStatus(req: Request, res: Response): Promise<void> {
    try {
      const { toStatus, reason, finalAnswer } = req.body as z.infer<typeof changeStatusSchema>;
      const dto = await appealService.changeStatus(req.user!, pathParam(req, "id"), toStatus, reason, finalAnswer);
      this.handleSuccess(res, dto);
    } catch (error) {
      this.handleError(error, res, "changeStatus");
    }
  }

  async assign(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.body as { userId: string };
      const dto = await appealService.assign(req.user!, pathParam(req, "id"), userId);
      this.handleSuccess(res, dto);
    } catch (error) {
      this.handleError(error, res, "assign");
    }
  }

  async setWorkingEdit(req: Request, res: Response): Promise<void> {
    try {
      const { workingEdit } = req.body as { workingEdit: string };
      const dto = await appealService.setWorkingEdit(req.user!, pathParam(req, "id"), workingEdit);
      this.handleSuccess(res, dto);
    } catch (error) {
      this.handleError(error, res, "setWorkingEdit");
    }
  }

  async setEpic(req: Request, res: Response): Promise<void> {
    try {
      const { epicId } = req.body as { epicId: string | null };
      const dto = await appealService.setEpic(req.user!, pathParam(req, "id"), epicId);
      this.handleSuccess(res, dto);
    } catch (error) {
      this.handleError(error, res, "setEpic");
    }
  }

  async addComment(req: Request, res: Response): Promise<void> {
    try {
      const { text, visibility, mentionedUserIds } = req.body as {
        text: string;
        visibility: "INTERNAL" | "PUBLIC";
        mentionedUserIds?: string[];
      };
      const dto = await appealService.addComment(
        req.user!,
        pathParam(req, "id"),
        text,
        visibility,
        mentionedUserIds,
      );
      this.handleSuccess(res, dto, 201);
    } catch (error) {
      this.handleError(error, res, "addComment");
    }
  }

  async addAuthorReplyFromBot(req: Request, res: Response): Promise<void> {
    try {
      const { telegramId, text } = req.body as { telegramId: string; text: string };
      await appealService.addAuthorReply(BigInt(telegramId), pathParam(req, "id"), text);
      this.handleSuccess(res, { ok: true }, 201);
    } catch (error) {
      this.handleError(error, res, "addAuthorReplyFromBot");
    }
  }

  async setRatingFromBot(req: Request, res: Response): Promise<void> {
    try {
      const { telegramId, score, comment } = req.body as {
        telegramId: string;
        score: number;
        comment?: string;
      };
      await appealService.setRating(BigInt(telegramId), pathParam(req, "id"), score, comment);
      this.handleSuccess(res, { ok: true });
    } catch (error) {
      this.handleError(error, res, "setRatingFromBot");
    }
  }

  async getAttachmentUrl(req: Request, res: Response): Promise<void> {
    try {
      const url = await appealService.getAttachmentUrl(req.user!, pathParam(req, "id"), pathParam(req, "attachmentId"));
      this.handleSuccess(res, { url });
    } catch (error) {
      this.handleError(error, res, "getAttachmentUrl");
    }
  }
}

export const appealController = new AppealController();
