import { Router } from "express";
import { notificationController } from "@/controllers/NotificationController.js";
import { requireBotService, requireWebAuth } from "@/middleware/auth.js";
import { asyncErrorWrapper } from "@/middleware/asyncErrorWrapper.js";

export const notificationRoutes = Router();

notificationRoutes.get(
  "/pending",
  requireBotService("EMPLOYEE"),
  asyncErrorWrapper((req, res) => notificationController.pendingForBot(req, res)),
);
notificationRoutes.post(
  "/:id/ack",
  requireBotService("EMPLOYEE"),
  asyncErrorWrapper((req, res) => notificationController.ack(req, res)),
);

notificationRoutes.get(
  "/",
  requireWebAuth,
  asyncErrorWrapper((req, res) => notificationController.listForWebUser(req, res)),
);
notificationRoutes.post(
  "/:id/read",
  requireWebAuth,
  asyncErrorWrapper((req, res) => notificationController.markRead(req, res)),
);
