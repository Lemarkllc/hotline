import { Router } from "express";
import { epicController } from "@/controllers/EpicController.js";
import { requireWebAuth } from "@/middleware/auth.js";
import { asyncErrorWrapper } from "@/middleware/asyncErrorWrapper.js";
import { validate } from "@/middleware/validate.js";
import { createEpicSchema, listEpicsQuerySchema, setEpicActiveSchema } from "@/validators/epic.schema.js";

export const epicRoutes = Router();

epicRoutes.use(requireWebAuth);

epicRoutes.get("/", validate(listEpicsQuerySchema, "query"), asyncErrorWrapper((req, res) => epicController.list(req, res)));
epicRoutes.post("/", validate(createEpicSchema), asyncErrorWrapper((req, res) => epicController.create(req, res)));
epicRoutes.patch(
  "/:id/active",
  validate(setEpicActiveSchema),
  asyncErrorWrapper((req, res) => epicController.setActive(req, res)),
);
