import { Router } from "express";
import { bitrixLeadSlaController } from "@/controllers/BitrixLeadSlaController.js";
import { requireWebAuth } from "@/middleware/auth.js";
import { requirePlainPermission } from "@/middleware/rbac.js";
import { asyncErrorWrapper } from "@/middleware/asyncErrorWrapper.js";

/** «SLA Лиды» (grill-me допрос 2026-09-12) — зависшие лиды Bitrix, не связано с
 * EmailLead/«Заявками». Тот же lead.manage, что и у leadRoutes — та же аудитория
 * (SALES), новое право заводить незачем. */
export const bitrixLeadSlaRoutes = Router();

bitrixLeadSlaRoutes.use(requireWebAuth, requirePlainPermission("lead.manage"));

bitrixLeadSlaRoutes.get("/stalled", asyncErrorWrapper((req, res) => bitrixLeadSlaController.listStalled(req, res)));
