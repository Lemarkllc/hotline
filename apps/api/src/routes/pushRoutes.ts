import { Router } from "express";
import { pushController } from "@/controllers/PushController.js";
import { requireWebAuth } from "@/middleware/auth.js";
import { asyncErrorWrapper } from "@/middleware/asyncErrorWrapper.js";
import { validate } from "@/middleware/validate.js";
import { subscribePushSchema, unsubscribePushSchema } from "@/validators/push.schema.js";

export const pushRoutes = Router();

pushRoutes.get("/public-key", asyncErrorWrapper((req, res) => pushController.publicKey(req, res)));

pushRoutes.use(requireWebAuth);
pushRoutes.post(
  "/subscribe",
  validate(subscribePushSchema),
  asyncErrorWrapper((req, res) => pushController.subscribe(req, res)),
);
pushRoutes.post(
  "/unsubscribe",
  validate(unsubscribePushSchema),
  asyncErrorWrapper((req, res) => pushController.unsubscribe(req, res)),
);
