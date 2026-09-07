import type { Request, Response } from "express";
import type { z } from "zod";
import { BaseController } from "@/controllers/BaseController.js";
import { businessTripService } from "@/services/businessTripService.js";
import { pathParam } from "@/utils/params.js";
import type {
  createBusinessTripRequestBotSchema,
  listBusinessTripRequestsQuerySchema,
  rejectHrRequestSchema,
} from "@/validators/businessTrip.schema.js";

export class BusinessTripController extends BaseController {
  async createFromBot(req: Request, res: Response): Promise<void> {
    try {
      const { telegramId, dateFrom, dateTo, purpose, transport, transportOther, hotelNeeded } = req.body as z.infer<
        typeof createBusinessTripRequestBotSchema
      >;
      const request = await businessTripService.createFromBot(BigInt(telegramId), {
        dateFrom,
        dateTo,
        purpose,
        transport,
        transportOther,
        hotelNeeded,
      });
      this.handleSuccess(res, request, 201);
    } catch (error) {
      this.handleError(error, res, "businessTrip.createFromBot");
    }
  }

  async list(req: Request, res: Response): Promise<void> {
    try {
      const { status } = req.query as unknown as z.infer<typeof listBusinessTripRequestsQuerySchema>;
      const requests = await businessTripService.list(req.user!, status);
      this.handleSuccess(res, requests);
    } catch (error) {
      this.handleError(error, res, "businessTrip.list");
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const request = await businessTripService.getById(req.user!, pathParam(req, "id"));
      this.handleSuccess(res, request);
    } catch (error) {
      this.handleError(error, res, "businessTrip.getById");
    }
  }

  async approve(req: Request, res: Response): Promise<void> {
    try {
      const request = await businessTripService.approve(req.user!, pathParam(req, "id"));
      this.handleSuccess(res, request);
    } catch (error) {
      this.handleError(error, res, "businessTrip.approve");
    }
  }

  async reject(req: Request, res: Response): Promise<void> {
    try {
      const { reason } = req.body as z.infer<typeof rejectHrRequestSchema>;
      const request = await businessTripService.reject(req.user!, pathParam(req, "id"), reason);
      this.handleSuccess(res, request);
    } catch (error) {
      this.handleError(error, res, "businessTrip.reject");
    }
  }
}

export const businessTripController = new BusinessTripController();
