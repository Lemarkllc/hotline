import { Router } from "express";
import { z } from "zod";
import { customerAppealController } from "@/controllers/CustomerAppealController.js";
import { requireBotService } from "@/middleware/auth.js";
import { asyncErrorWrapper } from "@/middleware/asyncErrorWrapper.js";
import { validate } from "@/middleware/validate.js";
import {
  botCreateMessageSchema,
  createCustomerAppealBotSchema,
  customerRatingBotSchema,
  myAppealsQuerySchema,
} from "@/validators/appeal.schema.js";

/**
 * Бот клиентов (канал CUSTOMER, Фаза 7, PLAN.md §6) — отдельные роуты, не переиспользуют
 * /appeals: requireBotService фиксирует канал на роуте (оба бота используют один и тот
 * же BOT_SERVICE_TOKEN), а Express не различит два хендлера на одном методе+пути.
 */
export const customerAppealRoutes = Router();

customerAppealRoutes.post(
  "/",
  requireBotService("CUSTOMER"),
  validate(createCustomerAppealBotSchema),
  asyncErrorWrapper((req, res) => customerAppealController.create(req, res)),
);

customerAppealRoutes.get(
  "/mine",
  requireBotService("CUSTOMER"),
  validate(myAppealsQuerySchema, "query"),
  asyncErrorWrapper((req, res) => customerAppealController.listMine(req, res)),
);

customerAppealRoutes.get(
  "/mine/:id",
  requireBotService("CUSTOMER"),
  validate(z.object({ telegramId: z.union([z.string(), z.number()]).transform(String) }), "query"),
  asyncErrorWrapper((req, res) => customerAppealController.getMineDetail(req, res)),
);

customerAppealRoutes.post(
  "/:id/reply",
  requireBotService("CUSTOMER"),
  validate(botCreateMessageSchema),
  asyncErrorWrapper((req, res) => customerAppealController.reply(req, res)),
);

customerAppealRoutes.post(
  "/:id/rating",
  requireBotService("CUSTOMER"),
  validate(customerRatingBotSchema),
  asyncErrorWrapper((req, res) => customerAppealController.setRating(req, res)),
);
