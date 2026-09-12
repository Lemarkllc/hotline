import { Router } from "express";
import { managerLeadRatingController } from "@/controllers/ManagerLeadRatingController.js";
import { requireWebAuth } from "@/middleware/auth.js";
import { requirePlainPermission } from "@/middleware/rbac.js";
import { asyncErrorWrapper } from "@/middleware/asyncErrorWrapper.js";
import { validate } from "@/middleware/validate.js";
import { leadDateRangeQuerySchema } from "@/validators/lead.schema.js";

/** «Рейтинг менеджеров» по лидам (grill-me допрос 2026-09-12) — тот же lead.manage,
 * что и у leadRoutes/bitrixLeadSlaRoutes, та же аудитория (SALES). */
export const managerLeadRatingRoutes = Router();

managerLeadRatingRoutes.use(requireWebAuth, requirePlainPermission("lead.manage"));

managerLeadRatingRoutes.get(
  "/stats",
  validate(leadDateRangeQuerySchema, "query"),
  asyncErrorWrapper((req, res) => managerLeadRatingController.getStats(req, res)),
);

managerLeadRatingRoutes.get(
  "/weekly-trend",
  validate(leadDateRangeQuerySchema, "query"),
  asyncErrorWrapper((req, res) => managerLeadRatingController.getWeeklyTrend(req, res)),
);
