import { Router } from "express";
import { vacationController } from "@/controllers/VacationController.js";
import { requireBotService, requireWebAuth } from "@/middleware/auth.js";
import { requirePlainPermission } from "@/middleware/rbac.js";
import { asyncErrorWrapper } from "@/middleware/asyncErrorWrapper.js";
import { validate } from "@/middleware/validate.js";
import {
  createVacationRequestBotSchema,
  listVacationRequestsQuerySchema,
  rejectHrRequestSchema,
  vacationBalanceQuerySchema,
} from "@/validators/vacation.schema.js";

/** «Отпуска» — независимая от Appeal/channel подсистема (см. VacationRequest в
 * schema.prisma), поэтому requirePlainPermission("vacation.manage"), не
 * requirePermission() (тот канало-скоуплен, см. middleware/rbac.ts — тот же приём,
 * что и у leadRoutes). Роут смешивает бот- и веб-эндпоинты в одном файле, как
 * appealRoutes.ts — авторизация per-route, не общий .use() посреди файла.
 * "/balance" объявлен ДО "/:id" — иначе Express отдал бы его туда как id="balance". */
export const vacationRoutes = Router();

vacationRoutes.post(
  "/",
  requireBotService("EMPLOYEE"),
  validate(createVacationRequestBotSchema),
  asyncErrorWrapper((req, res) => vacationController.createFromBot(req, res)),
);

vacationRoutes.get(
  "/balance",
  requireBotService("EMPLOYEE"),
  validate(vacationBalanceQuerySchema, "query"),
  asyncErrorWrapper((req, res) => vacationController.getBalanceFromBot(req, res)),
);

vacationRoutes.get(
  "/",
  requireWebAuth,
  requirePlainPermission("vacation.manage"),
  validate(listVacationRequestsQuerySchema, "query"),
  asyncErrorWrapper((req, res) => vacationController.list(req, res)),
);

vacationRoutes.get(
  "/:id",
  requireWebAuth,
  requirePlainPermission("vacation.manage"),
  asyncErrorWrapper((req, res) => vacationController.getById(req, res)),
);

vacationRoutes.post(
  "/:id/approve",
  requireWebAuth,
  requirePlainPermission("vacation.manage"),
  asyncErrorWrapper((req, res) => vacationController.approve(req, res)),
);

vacationRoutes.post(
  "/:id/reject",
  requireWebAuth,
  requirePlainPermission("vacation.manage"),
  validate(rejectHrRequestSchema),
  asyncErrorWrapper((req, res) => vacationController.reject(req, res)),
);
