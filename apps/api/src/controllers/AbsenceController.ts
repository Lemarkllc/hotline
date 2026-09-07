import type { Request, Response } from "express";
import type { z } from "zod";
import { BaseController } from "@/controllers/BaseController.js";
import { absenceService } from "@/services/absenceService.js";
import { pathParam } from "@/utils/params.js";
import type {
  createAbsenceRequestBotSchema,
  listAbsenceRequestsQuerySchema,
  rejectHrRequestSchema,
} from "@/validators/absence.schema.js";

export class AbsenceController extends BaseController {
  async createFromBot(req: Request, res: Response): Promise<void> {
    try {
      const { telegramId, date, fullDay, timeFrom, timeTo, reason } = req.body as z.infer<
        typeof createAbsenceRequestBotSchema
      >;
      const request = await absenceService.createFromBot(BigInt(telegramId), { date, fullDay, timeFrom, timeTo, reason });
      this.handleSuccess(res, request, 201);
    } catch (error) {
      this.handleError(error, res, "absence.createFromBot");
    }
  }

  async list(req: Request, res: Response): Promise<void> {
    try {
      const { status } = req.query as unknown as z.infer<typeof listAbsenceRequestsQuerySchema>;
      const requests = await absenceService.list(req.user!, status);
      this.handleSuccess(res, requests);
    } catch (error) {
      this.handleError(error, res, "absence.list");
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const request = await absenceService.getById(req.user!, pathParam(req, "id"));
      this.handleSuccess(res, request);
    } catch (error) {
      this.handleError(error, res, "absence.getById");
    }
  }

  async approve(req: Request, res: Response): Promise<void> {
    try {
      const request = await absenceService.approve(req.user!, pathParam(req, "id"));
      this.handleSuccess(res, request);
    } catch (error) {
      this.handleError(error, res, "absence.approve");
    }
  }

  async reject(req: Request, res: Response): Promise<void> {
    try {
      const { reason } = req.body as z.infer<typeof rejectHrRequestSchema>;
      const request = await absenceService.reject(req.user!, pathParam(req, "id"), reason);
      this.handleSuccess(res, request);
    } catch (error) {
      this.handleError(error, res, "absence.reject");
    }
  }
}

export const absenceController = new AbsenceController();
