import { Router } from "express";
import { leadController } from "@/controllers/LeadController.js";
import { requireWebAuth } from "@/middleware/auth.js";
import { requirePlainPermission } from "@/middleware/rbac.js";
import { asyncErrorWrapper } from "@/middleware/asyncErrorWrapper.js";
import { validate } from "@/middleware/validate.js";
import {
  conversionStatsQuerySchema,
  convertLeadToCrmSchema,
  listLeadsQuerySchema,
  searchBitrixUsersQuerySchema,
  stopListLeadSchema,
} from "@/validators/lead.schema.js";

/** «Заявки» (email-лиды, PLAN.md) — независимая от Appeal/channel подсистема,
 * поэтому requirePlainPermission("lead.manage"), а не requirePermission() (тот
 * канало-скоуплен, см. middleware/rbac.ts). */
export const leadRoutes = Router();

leadRoutes.use(requireWebAuth, requirePlainPermission("lead.manage"));

leadRoutes.get("/", validate(listLeadsQuerySchema, "query"), asyncErrorWrapper((req, res) => leadController.list(req, res)));

leadRoutes.get(
  "/bitrix-users",
  validate(searchBitrixUsersQuerySchema, "query"),
  asyncErrorWrapper((req, res) => leadController.searchBitrixUsers(req, res)),
);

leadRoutes.get(
  "/conversion-stats",
  validate(conversionStatsQuerySchema, "query"),
  asyncErrorWrapper((req, res) => leadController.conversionStats(req, res)),
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
  "/:id/convert-to-crm",
  validate(convertLeadToCrmSchema),
  asyncErrorWrapper((req, res) => leadController.convertToCrm(req, res)),
);

leadRoutes.get(
  "/:id/attachments/:attachmentId/url",
  asyncErrorWrapper((req, res) => leadController.getAttachmentUrl(req, res)),
);
