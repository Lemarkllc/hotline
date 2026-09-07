import { Router } from "express";
import { businessTripController } from "@/controllers/BusinessTripController.js";
import { requireBotService, requireWebAuth } from "@/middleware/auth.js";
import { requirePlainPermission } from "@/middleware/rbac.js";
import { asyncErrorWrapper } from "@/middleware/asyncErrorWrapper.js";
import { validate } from "@/middleware/validate.js";
import {
  createBusinessTripRequestBotSchema,
  listBusinessTripRequestsQuerySchema,
  rejectHrRequestSchema,
} from "@/validators/businessTrip.schema.js";

/** «Командировка» (PLAN.md §10) — по образцу vacationRoutes.ts. */
export const businessTripRoutes = Router();

businessTripRoutes.post(
  "/",
  requireBotService("EMPLOYEE"),
  validate(createBusinessTripRequestBotSchema),
  asyncErrorWrapper((req, res) => businessTripController.createFromBot(req, res)),
);

businessTripRoutes.get(
  "/",
  requireWebAuth,
  requirePlainPermission("vacation.manage"),
  validate(listBusinessTripRequestsQuerySchema, "query"),
  asyncErrorWrapper((req, res) => businessTripController.list(req, res)),
);

businessTripRoutes.get(
  "/:id",
  requireWebAuth,
  requirePlainPermission("vacation.manage"),
  asyncErrorWrapper((req, res) => businessTripController.getById(req, res)),
);

businessTripRoutes.post(
  "/:id/approve",
  requireWebAuth,
  requirePlainPermission("vacation.manage"),
  asyncErrorWrapper((req, res) => businessTripController.approve(req, res)),
);

businessTripRoutes.post(
  "/:id/reject",
  requireWebAuth,
  requirePlainPermission("vacation.manage"),
  validate(rejectHrRequestSchema),
  asyncErrorWrapper((req, res) => businessTripController.reject(req, res)),
);
