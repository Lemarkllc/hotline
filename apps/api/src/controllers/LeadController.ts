import type { Request, Response } from "express";
import type { z } from "zod";
import { BaseController } from "@/controllers/BaseController.js";
import { leadService } from "@/services/leadService.js";
import { pathParam } from "@/utils/params.js";
import type {
  conversionStatsQuerySchema,
  convertLeadToCrmSchema,
  listLeadsQuerySchema,
  searchBitrixUsersQuerySchema,
  stopListLeadSchema,
} from "@/validators/lead.schema.js";

export class LeadController extends BaseController {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { stopListed } = req.query as unknown as z.infer<typeof listLeadsQuerySchema>;
      const leads = await leadService.list(Boolean(stopListed));
      this.handleSuccess(res, leads);
    } catch (error) {
      this.handleError(error, res, "list");
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const lead = await leadService.getById(pathParam(req, "id"));
      this.handleSuccess(res, lead);
    } catch (error) {
      this.handleError(error, res, "getById");
    }
  }

  async takeInProgress(req: Request, res: Response): Promise<void> {
    try {
      const lead = await leadService.takeInProgress(pathParam(req, "id"));
      this.handleSuccess(res, lead);
    } catch (error) {
      this.handleError(error, res, "takeInProgress");
    }
  }

  async stopList(req: Request, res: Response): Promise<void> {
    try {
      const { reason } = req.body as z.infer<typeof stopListLeadSchema>;
      const lead = await leadService.stopList(req.user!, pathParam(req, "id"), reason);
      this.handleSuccess(res, lead);
    } catch (error) {
      this.handleError(error, res, "stopList");
    }
  }

  async searchBitrixUsers(req: Request, res: Response): Promise<void> {
    try {
      const { query } = req.query as unknown as z.infer<typeof searchBitrixUsersQuerySchema>;
      const users = await leadService.searchBitrixUsers(query);
      this.handleSuccess(res, users);
    } catch (error) {
      this.handleError(error, res, "searchBitrixUsers");
    }
  }

  async convertToCrm(req: Request, res: Response): Promise<void> {
    try {
      const { bitrixUserId } = req.body as z.infer<typeof convertLeadToCrmSchema>;
      const lead = await leadService.convertToCrm(req.user!, pathParam(req, "id"), bitrixUserId);
      this.handleSuccess(res, lead);
    } catch (error) {
      this.handleError(error, res, "convertToCrm");
    }
  }

  async conversionStats(req: Request, res: Response): Promise<void> {
    try {
      const { from, to } = req.query as unknown as z.infer<typeof conversionStatsQuerySchema>;
      const stats = await leadService.conversionStats(from, to);
      this.handleSuccess(res, stats);
    } catch (error) {
      this.handleError(error, res, "conversionStats");
    }
  }
}

export const leadController = new LeadController();
