import { Router } from "express";
import { reportController } from "@/controllers/ReportController.js";
import { requireWebAuth } from "@/middleware/auth.js";
import { asyncErrorWrapper } from "@/middleware/asyncErrorWrapper.js";
import { validate } from "@/middleware/validate.js";
import { exportQuerySchema, reportQuerySchema } from "@/validators/report.schema.js";

export const reportRoutes = Router();

reportRoutes.use(requireWebAuth);

reportRoutes.get(
  "/summary",
  validate(reportQuerySchema, "query"),
  asyncErrorWrapper((req, res) => reportController.summary(req, res)),
);
reportRoutes.get(
  "/export",
  validate(exportQuerySchema, "query"),
  asyncErrorWrapper((req, res) => reportController.export(req, res)),
);
