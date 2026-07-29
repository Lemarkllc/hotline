import { Router } from "express";
import { userController } from "@/controllers/UserController.js";
import { requireBotService, requireWebAuth } from "@/middleware/auth.js";
import { requirePermission } from "@/middleware/rbac.js";
import { asyncErrorWrapper } from "@/middleware/asyncErrorWrapper.js";
import { validate } from "@/middleware/validate.js";
import {
  blockUserSchema,
  botDecideAccessRequestSchema,
  createWebAccountSchema,
  decideAccessRequestSchema,
  updateUserSchema,
} from "@/validators/user.schema.js";

export const userRoutes = Router();

// --- bot-employee (HRD подтверждает заявку из Telegram — дополнение к FR-USR-003,
// Администратор по-прежнему подтверждает с web-панели тем же способом, что и раньше) ---
userRoutes.post(
  "/access-requests/:id/approve-bot",
  requireBotService("EMPLOYEE"),
  validate(botDecideAccessRequestSchema),
  asyncErrorWrapper((req, res) => userController.approveFromBot(req, res)),
);
userRoutes.post(
  "/access-requests/:id/reject-bot",
  requireBotService("EMPLOYEE"),
  validate(botDecideAccessRequestSchema),
  asyncErrorWrapper((req, res) => userController.rejectFromBot(req, res)),
);

// --- web (Администратор, user.manage) ---
userRoutes.get(
  "/",
  requireWebAuth,
  requirePermission("user.manage"),
  asyncErrorWrapper((req, res) => userController.list(req, res)),
);

// --- web, заявки на доступ: Администратор ИЛИ HRD напрямую по роли (не user.manage —
// см. userService.requireHrdOrAdmin, второй слой авторизации, реальная власть там) ---
userRoutes.get(
  "/access-requests",
  requireWebAuth,
  asyncErrorWrapper((req, res) => userController.listAccessRequests(req, res)),
);
userRoutes.post(
  "/access-requests/:id/approve",
  requireWebAuth,
  asyncErrorWrapper((req, res) => userController.approve(req, res)),
);
userRoutes.post(
  "/access-requests/:id/reject",
  requireWebAuth,
  validate(decideAccessRequestSchema),
  asyncErrorWrapper((req, res) => userController.reject(req, res)),
);
userRoutes.patch(
  "/:id",
  requireWebAuth,
  requirePermission("user.manage"),
  validate(updateUserSchema),
  asyncErrorWrapper((req, res) => userController.update(req, res)),
);
userRoutes.post(
  "/:id/reset-password",
  requireWebAuth,
  requirePermission("user.manage"),
  asyncErrorWrapper((req, res) => userController.resetPassword(req, res)),
);
userRoutes.post(
  "/:id/block",
  requireWebAuth,
  requirePermission("user.manage"),
  validate(blockUserSchema),
  asyncErrorWrapper((req, res) => userController.block(req, res)),
);
userRoutes.post(
  "/:id/archive",
  requireWebAuth,
  requirePermission("user.manage"),
  asyncErrorWrapper((req, res) => userController.archive(req, res)),
);
userRoutes.post(
  "/",
  requireWebAuth,
  requirePermission("user.manage"),
  validate(createWebAccountSchema),
  asyncErrorWrapper((req, res) => userController.createWebAccount(req, res)),
);
