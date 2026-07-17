import type { Request, Response } from "express";
import type { Channel } from "@hotline/shared";
import { BaseController } from "@/controllers/BaseController.js";
import { epicService } from "@/services/epicService.js";
import { pathParam } from "@/utils/params.js";

export class EpicController extends BaseController {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { channel, includeInactive } = req.query as unknown as {
        channel: Channel;
        includeInactive: boolean;
      };
      const epics = await epicService.list(channel, includeInactive);
      this.handleSuccess(res, epics);
    } catch (error) {
      this.handleError(error, res, "list");
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const { channel, name } = req.body as { channel: Channel; name: string };
      const epic = await epicService.create(req.user!, channel, name);
      this.handleSuccess(res, epic, 201);
    } catch (error) {
      this.handleError(error, res, "create");
    }
  }

  async setActive(req: Request, res: Response): Promise<void> {
    try {
      const { isActive } = req.body as { isActive: boolean };
      const epic = await epicService.setActive(req.user!, pathParam(req, "id"), isActive);
      this.handleSuccess(res, epic);
    } catch (error) {
      this.handleError(error, res, "setActive");
    }
  }
}

export const epicController = new EpicController();
