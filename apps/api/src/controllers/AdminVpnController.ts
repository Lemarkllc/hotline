import type { Request, Response } from "express";
import type { z } from "zod";
import { BaseController } from "@/controllers/BaseController.js";
import { adminVpnService } from "@/services/adminVpnService.js";
import { pathParam } from "@/utils/params.js";
import type {
  addVpnEmployeeSchema,
  createVpnSchema,
  deleteVpnDeviceSchema,
  sendVpnEmailSchema,
  setVpnDeviceLimitSchema,
} from "@/validators/adminVpn.schema.js";

/** Раздел «VPN» Администратора (user.manage — на маршруте). */
export class AdminVpnController extends BaseController {
  async list(_req: Request, res: Response): Promise<void> {
    try {
      this.handleSuccess(res, await adminVpnService.list());
    } catch (error) {
      this.handleError(error, res, "adminVpn.list");
    }
  }

  async getCard(req: Request, res: Response): Promise<void> {
    try {
      this.handleSuccess(res, await adminVpnService.getCard(pathParam(req, "userId")));
    } catch (error) {
      this.handleError(error, res, "adminVpn.getCard");
    }
  }

  async addEmployee(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as z.infer<typeof addVpnEmployeeSchema>;
      const result = await adminVpnService.addEmployee(req.user!, { ...body, telegramId: BigInt(body.telegramId) });
      this.handleSuccess(res, result, 201);
    } catch (error) {
      this.handleError(error, res, "adminVpn.addEmployee");
    }
  }

  async createVpn(req: Request, res: Response): Promise<void> {
    try {
      const { deviceLimit } = req.body as z.infer<typeof createVpnSchema>;
      await adminVpnService.createVpn(req.user!, pathParam(req, "userId"), deviceLimit);
      this.handleSuccess(res, { ok: true });
    } catch (error) {
      this.handleError(error, res, "adminVpn.createVpn");
    }
  }

  async reissue(req: Request, res: Response): Promise<void> {
    try {
      await adminVpnService.reissue(req.user!, pathParam(req, "userId"));
      this.handleSuccess(res, { ok: true });
    } catch (error) {
      this.handleError(error, res, "adminVpn.reissue");
    }
  }

  async disable(req: Request, res: Response): Promise<void> {
    try {
      await adminVpnService.disable(req.user!, pathParam(req, "userId"));
      this.handleSuccess(res, { ok: true });
    } catch (error) {
      this.handleError(error, res, "adminVpn.disable");
    }
  }

  async setDeviceLimit(req: Request, res: Response): Promise<void> {
    try {
      const { deviceLimit } = req.body as z.infer<typeof setVpnDeviceLimitSchema>;
      await adminVpnService.setDeviceLimit(req.user!, pathParam(req, "userId"), deviceLimit);
      this.handleSuccess(res, { ok: true });
    } catch (error) {
      this.handleError(error, res, "adminVpn.setDeviceLimit");
    }
  }

  async deleteDevice(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId } = req.body as z.infer<typeof deleteVpnDeviceSchema>;
      await adminVpnService.deleteDevice(req.user!, pathParam(req, "userId"), deviceId);
      this.handleSuccess(res, { ok: true });
    } catch (error) {
      this.handleError(error, res, "adminVpn.deleteDevice");
    }
  }

  async sendEmail(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body as z.infer<typeof sendVpnEmailSchema>;
      this.handleSuccess(res, await adminVpnService.sendEmail(req.user!, pathParam(req, "userId"), email));
    } catch (error) {
      this.handleError(error, res, "adminVpn.sendEmail");
    }
  }
}

export const adminVpnController = new AdminVpnController();
