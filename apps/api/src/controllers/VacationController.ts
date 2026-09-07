import type { Request, Response } from "express";
import type { z } from "zod";
import { BaseController } from "@/controllers/BaseController.js";
import { vacationService } from "@/services/vacationService.js";
import { pathParam } from "@/utils/params.js";
import type {
  createVacationRequestBotSchema,
  listVacationRequestsQuerySchema,
  rejectHrRequestSchema,
  vacationBalanceQuerySchema,
} from "@/validators/vacation.schema.js";

export class VacationController extends BaseController {
  async createFromBot(req: Request, res: Response): Promise<void> {
    try {
      const { telegramId, dateFrom, dateTo, comment, paid } = req.body as z.infer<typeof createVacationRequestBotSchema>;
      const request = await vacationService.createFromBot(BigInt(telegramId), { dateFrom, dateTo, comment, paid });
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
      const { status } = req.query as unknown as z.infer<typeof listVacationRequestsQuerySchema>;
      const requests = await vacationService.list(req.user!, status);
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
}

export const vacationController = new VacationController();
