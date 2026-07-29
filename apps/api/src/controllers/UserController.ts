import type { Request, Response } from "express";
import type { Channel } from "@hotline/shared";
import { BaseController } from "@/controllers/BaseController.js";
import { userService } from "@/services/userService.js";
import { pathParam } from "@/utils/params.js";

export class UserController extends BaseController {
  async listAssignable(req: Request, res: Response): Promise<void> {
    try {
      const channel = (req.query.channel as Channel) || "EMPLOYEE";
      const users = await userService.listAssignable(channel);
      this.handleSuccess(res, users);
    } catch (error) {
      this.handleError(error, res, "listAssignable");
    }
  }

  async listAccessRequests(req: Request, res: Response): Promise<void> {
    try {
      const requests = await userService.listAccessRequests(req.user!);
      this.handleSuccess(res, requests);
    } catch (error) {
      this.handleError(error, res, "listAccessRequests");
    }
  }

  async list(req: Request, res: Response): Promise<void> {
    try {
      const { status } = req.query as { status?: string };
      const users = await userService.list(status);
      this.handleSuccess(res, users);
    } catch (error) {
      this.handleError(error, res, "list");
    }
  }

  async approve(req: Request, res: Response): Promise<void> {
    try {
      await userService.approveAccessRequest(req.user!, pathParam(req, "id"));
      this.handleSuccess(res, { ok: true });
    } catch (error) {
      this.handleError(error, res, "approve");
    }
  }

  async reject(req: Request, res: Response): Promise<void> {
    try {
      const { reason } = req.body as { reason?: string };
      await userService.rejectAccessRequest(req.user!, pathParam(req, "id"), reason);
      this.handleSuccess(res, { ok: true });
    } catch (error) {
      this.handleError(error, res, "reject");
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const user = await userService.updateUser(req.user!, pathParam(req, "id"), req.body);
      this.handleSuccess(res, user);
    } catch (error) {
      this.handleError(error, res, "update");
    }
  }

  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const result = await userService.resetPassword(req.user!, pathParam(req, "id"));
      this.handleSuccess(res, result);
    } catch (error) {
      this.handleError(error, res, "resetPassword");
    }
  }

  async approveFromBot(req: Request, res: Response): Promise<void> {
    try {
      const { telegramId } = req.body as { telegramId: string };
      await userService.approveAccessRequestFromBot(BigInt(telegramId), pathParam(req, "id"));
      this.handleSuccess(res, { ok: true });
    } catch (error) {
      this.handleError(error, res, "approveFromBot");
    }
  }

  async rejectFromBot(req: Request, res: Response): Promise<void> {
    try {
      const { telegramId, reason } = req.body as { telegramId: string; reason?: string };
      await userService.rejectAccessRequestFromBot(BigInt(telegramId), pathParam(req, "id"), reason);
      this.handleSuccess(res, { ok: true });
    } catch (error) {
      this.handleError(error, res, "rejectFromBot");
    }
  }

  async block(req: Request, res: Response): Promise<void> {
    try {
      const { reason } = req.body as { reason: string };
      await userService.blockUser(req.user!, pathParam(req, "id"), reason);
      this.handleSuccess(res, { ok: true });
    } catch (error) {
      this.handleError(error, res, "block");
    }
  }

  async archive(req: Request, res: Response): Promise<void> {
    try {
      await userService.archiveUser(req.user!, pathParam(req, "id"));
      this.handleSuccess(res, { ok: true });
    } catch (error) {
      this.handleError(error, res, "archive");
    }
  }

  async createWebAccount(req: Request, res: Response): Promise<void> {
    try {
      const user = await userService.createWebAccount(req.user!, req.body);
      this.handleSuccess(res, user, 201);
    } catch (error) {
      this.handleError(error, res, "createWebAccount");
    }
  }
}

export const userController = new UserController();
