import { Router } from "express";
import { absenceController } from "@/controllers/AbsenceController.js";
import { requireBotService, requireWebAuth } from "@/middleware/auth.js";
import { requirePlainPermission } from "@/middleware/rbac.js";
import { asyncErrorWrapper } from "@/middleware/asyncErrorWrapper.js";
import { validate } from "@/middleware/validate.js";
import {
  createAbsenceRequestBotSchema,
  listAbsenceRequestsQuerySchema,
  rejectHrRequestSchema,
} from "@/validators/absence.schema.js";

/** «Отсутствие» (PLAN.md §10) — по образцу vacationRoutes.ts. */
export const absenceRoutes = Router();

absenceRoutes.post(
  "/",
  requireBotService("EMPLOYEE"),
  validate(createAbsenceRequestBotSchema),
  asyncErrorWrapper((req, res) => absenceController.createFromBot(req, res)),
);

absenceRoutes.get(
  "/",
  requireWebAuth,
  requirePlainPermission("vacation.manage"),
  validate(listAbsenceRequestsQuerySchema, "query"),
  asyncErrorWrapper((req, res) => absenceController.list(req, res)),
);

absenceRoutes.get(
  "/:id",
  requireWebAuth,
  requirePlainPermission("vacation.manage"),
  asyncErrorWrapper((req, res) => absenceController.getById(req, res)),
);

absenceRoutes.post(
  "/:id/approve",
  requireWebAuth,
  requirePlainPermission("vacation.manage"),
  asyncErrorWrapper((req, res) => absenceController.approve(req, res)),
);

absenceRoutes.post(
  "/:id/reject",
  requireWebAuth,
  requirePlainPermission("vacation.manage"),
  validate(rejectHrRequestSchema),
  asyncErrorWrapper((req, res) => absenceController.reject(req, res)),
);
