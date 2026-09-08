import type { Request, Response } from "express";
import type { z } from "zod";
import { BaseController } from "@/controllers/BaseController.js";
import { vacationService } from "@/services/vacationService.js";
import { pathParam } from "@/utils/params.js";
import type {
  createVacationRequestBotSchema,
  listVacationRequestsQuerySchema,
  rejectHrRequestSchema,
  updateVacationChecklistSchema,
  vacationBalanceQuerySchema,
} from "@/validators/vacation.schema.js";

export class VacationController extends BaseController {
  async createFromBot(req: Request, res: Response): Promise<void> {
    try {
      const { telegramId, dateFrom, dateTo, comment, paid, attachmentIds } = req.body as z.infer<
        typeof createVacationRequestBotSchema
      >;
      const request = await vacationService.createFromBot(BigInt(telegramId), {
        dateFrom,
        dateTo,
        comment,
        paid,
        attachmentIds,
      });
      this.handleSuccess(res, request, 201);
    } catch (error) {
      this.handleError(error, res, "vacation.createFromBot");
    }
  }

  /** Кнопка «Узнать количество дней отпуска» внутри диалога бота (PLAN.md §10). */
  async getBalanceFromBot(req: Request, res: Response): Promise<void> {
    try {
      const { telegramId } = req.query as unknown as z.infer<typeof vacationBalanceQuerySchema>;
      const availableDays = await vacationService.getAvailableDaysFromBot(BigInt(telegramId));
      this.handleSuccess(res, { availableDays });
    } catch (error) {
      this.handleError(error, res, "vacation.getBalanceFromBot");
    }
  }

  async list(req: Request, res: Response): Promise<void> {
    try {
      const { status, processed } = req.query as unknown as z.infer<typeof listVacationRequestsQuerySchema>;
      const requests = await vacationService.list(
        req.user!,
        status,
        processed === undefined ? undefined : processed === "true",
      );
      this.handleSuccess(res, requests);
    } catch (error) {
      this.handleError(error, res, "vacation.list");
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const request = await vacationService.getById(req.user!, pathParam(req, "id"));
      this.handleSuccess(res, request);
    } catch (error) {
      this.handleError(error, res, "vacation.getById");
    }
  }

  async approve(req: Request, res: Response): Promise<void> {
    try {
      const request = await vacationService.approve(req.user!, pathParam(req, "id"));
      this.handleSuccess(res, request);
    } catch (error) {
      this.handleError(error, res, "vacation.approve");
    }
  }

  async reject(req: Request, res: Response): Promise<void> {
    try {
      const { reason } = req.body as z.infer<typeof rejectHrRequestSchema>;
      const request = await vacationService.reject(req.user!, pathParam(req, "id"), reason);
      this.handleSuccess(res, request);
    } catch (error) {
      this.handleError(error, res, "vacation.reject");
    }
  }

  async updateChecklist(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body as z.infer<typeof updateVacationChecklistSchema>;
      const request = await vacationService.updateChecklist(req.user!, pathParam(req, "id"), data);
      this.handleSuccess(res, request);
    } catch (error) {
      this.handleError(error, res, "vacation.updateChecklist");
    }
  }

  async process(req: Request, res: Response): Promise<void> {
    try {
      const request = await vacationService.process(req.user!, pathParam(req, "id"));
      this.handleSuccess(res, request);
    } catch (error) {
      this.handleError(error, res, "vacation.process");
    }
  }

  async getAttachmentUrl(req: Request, res: Response): Promise<void> {
    try {
      const url = await vacationService.getAttachmentUrl(
        req.user!,
        pathParam(req, "id"),
        pathParam(req, "attachmentId"),
        req.query.download === "true",
      );
      this.handleSuccess(res, { url });
    } catch (error) {
      this.handleError(error, res, "vacation.getAttachmentUrl");
    }
  }
}

export const vacationController = new VacationController();
