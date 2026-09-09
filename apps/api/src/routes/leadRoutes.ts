import { Router } from "express";
import { leadController } from "@/controllers/LeadController.js";
import { requireWebAuth } from "@/middleware/auth.js";
import { requireAnyPlainPermission, requirePlainPermission } from "@/middleware/rbac.js";
import { asyncErrorWrapper } from "@/middleware/asyncErrorWrapper.js";
import { validate } from "@/middleware/validate.js";
import {
  convertLeadToCrmSchema,
  leadDateRangeQuerySchema,
  listLeadsQuerySchema,
  replyToLeadSchema,
  searchBitrixUsersQuerySchema,
  stopListLeadSchema,
  updateLeadAutoConvertSettingSchema,
} from "@/validators/lead.schema.js";

/** «Заявки» (email-лиды, PLAN.md) — независимая от Appeal/channel подсистема,
 * поэтому requirePlainPermission("lead.manage"), а не requirePermission() (тот
 * канало-скоуплен, см. middleware/rbac.ts). */
export const leadRoutes = Router();

// Рубильник авто-передачи в CRM (leadService.getAutoConvertSetting/setAutoConvertSetting) —
// сознательно ДО блока requirePlainPermission("lead.manage") ниже: Express применяет
// router.use() без пути только к роутам, зарегистрированным ПОСЛЕ него, поэтому эти два
// эндпоинта получают собственный, более широкий гейт (Администратор без lead.manage,
// но с user.manage, тоже должен управлять рубильником — решение пользователя), а
// остальные lead-роуты ниже остаются как были, только под lead.manage.
leadRoutes.get(
  "/auto-convert-setting",
  requireWebAuth,
  requireAnyPlainPermission("lead.manage", "user.manage"),
  asyncErrorWrapper((req, res) => leadController.getAutoConvertSetting(req, res)),
);

leadRoutes.patch(
  "/auto-convert-setting",
  requireWebAuth,
  requireAnyPlainPermission("lead.manage", "user.manage"),
  validate(updateLeadAutoConvertSettingSchema),
  asyncErrorWrapper((req, res) => leadController.updateAutoConvertSetting(req, res)),
);

leadRoutes.use(requireWebAuth, requirePlainPermission("lead.manage"));

leadRoutes.get("/", validate(listLeadsQuerySchema, "query"), asyncErrorWrapper((req, res) => leadController.list(req, res)));

leadRoutes.get(
  "/bitrix-users",
  validate(searchBitrixUsersQuerySchema, "query"),
  asyncErrorWrapper((req, res) => leadController.searchBitrixUsers(req, res)),
);

leadRoutes.get(
  "/conversion-stats",
  validate(leadDateRangeQuerySchema, "query"),
  asyncErrorWrapper((req, res) => leadController.conversionStats(req, res)),
);

leadRoutes.get(
  "/daily-stats",
  validate(leadDateRangeQuerySchema, "query"),
  asyncErrorWrapper((req, res) => leadController.dailyStats(req, res)),
);

leadRoutes.get("/:id", asyncErrorWrapper((req, res) => leadController.getById(req, res)));

leadRoutes.post("/:id/take", asyncErrorWrapper((req, res) => leadController.takeInProgress(req, res)));

leadRoutes.post(
  "/:id/stop-list",
  validate(stopListLeadSchema),
  asyncErrorWrapper((req, res) => leadController.stopList(req, res)),
);

leadRoutes.post("/:id/restore", asyncErrorWrapper((req, res) => leadController.restore(req, res)));

leadRoutes.post(
  "/:id/reply",
  validate(replyToLeadSchema),
  asyncErrorWrapper((req, res) => leadController.reply(req, res)),
);

leadRoutes.post(
  "/:id/convert-to-crm",
  validate(convertLeadToCrmSchema),
  asyncErrorWrapper((req, res) => leadController.convertToCrm(req, res)),
);

leadRoutes.get(
  "/:id/attachments/:attachmentId/url",
  asyncErrorWrapper((req, res) => leadController.getAttachmentUrl(req, res)),
);
