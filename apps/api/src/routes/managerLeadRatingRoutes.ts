import { Router } from "express";
import { managerLeadRatingController } from "@/controllers/ManagerLeadRatingController.js";
import { requireWebAuth } from "@/middleware/auth.js";
import { requirePlainPermission } from "@/middleware/rbac.js";
import { asyncErrorWrapper } from "@/middleware/asyncErrorWrapper.js";
import { validate } from "@/middleware/validate.js";
import { leadDateRangeQuerySchema } from "@/validators/lead.schema.js";

/** «Рейтинг менеджеров» по лидам (grill-me допрос 2026-09-12) — временно только
 * Администратору (user.manage), не всей роли SALES как остальные lead-роуты
 * (решение пользователя, 2026-09-13: методология отчёта ещё дорабатывается —
 * CALL-шум портил цифры, см. BitrixLeadSnapshotRepository — показывать это
 * менеджерам как готовые данные преждевременно). Страница на фронте для
 * lead.manage без user.manage рендерит заглушку "на доработке", сюда вообще
 * не стучится — см. ManagerRatingPage.tsx. */
export const managerLeadRatingRoutes = Router();

managerLeadRatingRoutes.use(requireWebAuth, requirePlainPermission("user.manage"));

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
