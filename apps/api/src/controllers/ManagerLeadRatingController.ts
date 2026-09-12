import type { Request, Response } from "express";
import type { z } from "zod";
import { BaseController } from "@/controllers/BaseController.js";
import { managerLeadRatingService } from "@/services/managerLeadRatingService.js";
import type { leadDateRangeQuerySchema } from "@/validators/lead.schema.js";

export class ManagerLeadRatingController extends BaseController {
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const { from, to } = req.query as unknown as z.infer<typeof leadDateRangeQuerySchema>;
      const stats = await managerLeadRatingService.getStats(from, to);
      this.handleSuccess(res, stats);
    } catch (error) {
      this.handleError(error, res, "getStats");
    }
  }

  async getWeeklyTrend(req: Request, res: Response): Promise<void> {
    try {
      const { from, to } = req.query as unknown as z.infer<typeof leadDateRangeQuerySchema>;
      const trend = await managerLeadRatingService.getWeeklyTrend(from, to);
      this.handleSuccess(res, trend);
    } catch (error) {
      this.handleError(error, res, "getWeeklyTrend");
    }
  }
}

export const managerLeadRatingController = new ManagerLeadRatingController();
