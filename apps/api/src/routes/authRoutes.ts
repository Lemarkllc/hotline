import { Router } from "express";
import { telegramAuthSchema, webLoginSchema } from "@hotline/shared";
import { authController } from "@/controllers/AuthController.js";
import { requireBotService, requireWebAuth } from "@/middleware/auth.js";
import { asyncErrorWrapper } from "@/middleware/asyncErrorWrapper.js";
import { validate } from "@/middleware/validate.js";
import {
  changePasswordSchema,
  refreshTokenSchema,
  twoFactorConfirmSchema,
  twoFactorSetupSchema,
} from "@/validators/auth.schema.js";

export const authRoutes = Router();

authRoutes.post(
  "/telegram",
  requireBotService("EMPLOYEE"),
  validate(telegramAuthSchema),
  asyncErrorWrapper((req, res) => authController.telegramIdentify(req, res)),
);

authRoutes.post(
  "/login",
  validate(webLoginSchema),
  asyncErrorWrapper((req, res) => authController.webLogin(req, res)),
);

authRoutes.post(
  "/refresh",
  validate(refreshTokenSchema),
  asyncErrorWrapper((req, res) => authController.refresh(req, res)),
);

authRoutes.post(
  "/2fa/setup",
  validate(twoFactorSetupSchema),
  asyncErrorWrapper((req, res) => authController.beginTwoFactorSetup(req, res)),
);

authRoutes.post(
  "/2fa/confirm",
  validate(twoFactorConfirmSchema),
  asyncErrorWrapper((req, res) => authController.confirmTwoFactorSetup(req, res)),
);

authRoutes.post(
  "/change-password",
  requireWebAuth,
  validate(changePasswordSchema),
  asyncErrorWrapper((req, res) => authController.changePassword(req, res)),
);

authRoutes.get(
  "/me",
  requireWebAuth,
  asyncErrorWrapper((req, res) => authController.me(req, res)),
);
