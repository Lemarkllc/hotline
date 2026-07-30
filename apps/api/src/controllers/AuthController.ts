import type { Request, Response } from "express";
import { BaseController } from "@/controllers/BaseController.js";
import { authService } from "@/services/authService.js";

export class AuthController extends BaseController {
  /** Вызывается ботом сотрудников от имени Telegram-пользователя (FR-AUTH-001..004). */
  async telegramIdentify(req: Request, res: Response): Promise<void> {
    try {
      const { telegramId, fullName } = req.body as { telegramId: string; fullName?: string };
      const result = await authService.telegramIdentify({
        telegramId: BigInt(telegramId),
        fullName,
      });
      this.handleSuccess(res, result);
    } catch (error) {
      this.handleError(error, res, "telegramIdentify");
    }
  }

  /** Вызывается ботом клиентов от имени Telegram-пользователя (Фаза 7, PLAN.md §6). */
  async externalContactIdentify(req: Request, res: Response): Promise<void> {
    try {
      const { telegramId, fullName, consentVersion } = req.body as {
        telegramId: string;
        fullName?: string;
        consentVersion?: string;
      };
      const result = await authService.externalContactIdentify({
        telegramId: BigInt(telegramId),
        fullName,
        consentVersion,
      });
      this.handleSuccess(res, result);
    } catch (error) {
      this.handleError(error, res, "externalContactIdentify");
    }
  }

  async webLogin(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, totpCode } = req.body as {
        email: string;
        password: string;
        totpCode?: string;
      };
      const result = await authService.webLogin({
        email,
        password,
        totpCode,
        ipAddress: req.ip,
        userAgent: req.header("user-agent"),
        requestId: req.requestId,
      });
      this.handleSuccess(res, result);
    } catch (error) {
      this.handleError(error, res, "webLogin");
    }
  }

  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body as { refreshToken: string };
      const result = await authService.refresh(refreshToken);
      this.handleSuccess(res, result);
    } catch (error) {
      this.handleError(error, res, "refresh");
    }
  }

  async beginTwoFactorSetup(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body as { email: string; password: string };
      const result = await authService.beginTwoFactorSetup(email, password);
      this.handleSuccess(res, result);
    } catch (error) {
      this.handleError(error, res, "beginTwoFactorSetup");
    }
  }

  async confirmTwoFactorSetup(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, code } = req.body as { email: string; password: string; code: string };
      await authService.confirmTwoFactorSetup(email, password, code);
      this.handleSuccess(res, { ok: true });
    } catch (error) {
      this.handleError(error, res, "confirmTwoFactorSetup");
    }
  }

  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body as {
        currentPassword: string;
        newPassword: string;
      };
      await authService.changePassword(req.user!.id, currentPassword, newPassword);
      this.handleSuccess(res, { ok: true });
    } catch (error) {
      this.handleError(error, res, "changePassword");
    }
  }

  async me(req: Request, res: Response): Promise<void> {
    try {
      this.handleSuccess(res, req.user);
    } catch (error) {
      this.handleError(error, res, "me");
    }
  }
}

export const authController = new AuthController();
