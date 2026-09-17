import { Router } from "express";
import { asyncErrorWrapper } from "@/middleware/asyncErrorWrapper.js";
import { requireWebsiteWebhook } from "@/middleware/auth.js";
import { validate } from "@/middleware/validate.js";
import { websiteLeadController } from "@/controllers/WebsiteLeadController.js";
import { websiteLeadWebhookSchema } from "@/validators/websiteLead.schema.js";

export const websiteLeadRoutes = Router();

/**
 * Публичный хук формы lemarkllc.ru (вне этого репозитория) — НЕ requireWebAuth,
 * аутентификация общим секретом (requireWebsiteWebhook), тем же принципом, что и
 * requireBotService у ботов.
 */
websiteLeadRoutes.post(
  "/",
  requireWebsiteWebhook,
  validate(websiteLeadWebhookSchema),
  asyncErrorWrapper((req, res) => websiteLeadController.submit(req, res)),
);
