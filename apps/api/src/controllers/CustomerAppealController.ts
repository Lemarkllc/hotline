import type { Request, Response } from "express";
import type { z } from "zod";
import { createCustomerAppealSchema, customerRatingSchema } from "@hotline/shared";
import { BaseController } from "@/controllers/BaseController.js";
import { appealService } from "@/services/appealService.js";
import { pathParam } from "@/utils/params.js";
import type { myAppealsQuerySchema } from "@/validators/appeal.schema.js";

/**
 * Бот клиентов (канал CUSTOMER, Фаза 7, PLAN.md §6) — зеркало bot-facing методов
 * AppealController, но без approval-флоу и без вложений в этом заходе (см.
 * appealService "Канал CUSTOMER"). Отдельный контроллер, не общий с AppealController —
 * requireBotService фиксирует канал на роуте, смешивать employee/customer-логику
 * в одном классе только запутало бы, где what.
 */
export class CustomerAppealController extends BaseController {
  async create(req: Request, res: Response): Promise<void> {
    try {
      const { telegramId, type, mode, originalText } = req.body as z.infer<typeof createCustomerAppealSchema> & {
        telegramId: string;
      };
      const appeal = await appealService.createCustomerAppeal({
        telegramId: BigInt(telegramId),
        type,
        mode,
        originalText,
      });
      this.handleSuccess(res, { id: appeal.id, publicNumber: appeal.publicNumber }, 201);
    } catch (error) {
      this.handleError(error, res, "create");
    }
  }

  async listMine(req: Request, res: Response): Promise<void> {
    try {
      const { telegramId, page, pageSize, bucket } = req.query as unknown as z.infer<typeof myAppealsQuerySchema>;
      const result = await appealService.listMineForExternalContact(BigInt(telegramId), page, pageSize, bucket);
      this.handleSuccess(res, result);
    } catch (error) {
      this.handleError(error, res, "listMine");
    }
  }

  async getMineDetail(req: Request, res: Response): Promise<void> {
    try {
      const { telegramId } = req.query as { telegramId: string };
      const dto = await appealService.getByIdForExternalContact(BigInt(telegramId), pathParam(req, "id"));
      this.handleSuccess(res, dto);
    } catch (error) {
      this.handleError(error, res, "getMineDetail");
    }
  }

  async setRating(req: Request, res: Response): Promise<void> {
    try {
      const { telegramId, wouldRecommendScore, wouldReturnScore } = req.body as z.infer<
        typeof customerRatingSchema
      > & { telegramId: string };
      await appealService.setCustomerRating(BigInt(telegramId), pathParam(req, "id"), wouldRecommendScore, wouldReturnScore);
      this.handleSuccess(res, { ok: true });
    } catch (error) {
      this.handleError(error, res, "setRating");
    }
  }
}

export const customerAppealController = new CustomerAppealController();
