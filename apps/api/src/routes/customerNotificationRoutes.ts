import { Router } from "express";
import { notificationController } from "@/controllers/NotificationController.js";
import { requireBotService } from "@/middleware/auth.js";
import { asyncErrorWrapper } from "@/middleware/asyncErrorWrapper.js";

/**
 * Зеркало notificationRoutes.ts под канал CUSTOMER — отдельные роуты, не общий
 * /notifications/pending: requireBotService фиксирует канал на роуте, а не по токену
 * (оба бота используют один и тот же BOT_SERVICE_TOKEN, см. CLAUDE.md). До этой правки
 * bot-customer ходил в EMPLOYEE-роут напрямую (тот же общий токен пропускал), получал
 * там и чужие EMPLOYEE-уведомления, тихо ack'ал их как no-op — см. разбор бага в
 * NotificationRepository.listPending.
 */
export const customerNotificationRoutes = Router();

customerNotificationRoutes.get(
  "/pending",
  requireBotService("CUSTOMER"),
  asyncErrorWrapper((req, res) => notificationController.pendingForBot(req, res)),
);
customerNotificationRoutes.post(
  "/:id/ack",
  requireBotService("CUSTOMER"),
  asyncErrorWrapper((req, res) => notificationController.ack(req, res)),
);
