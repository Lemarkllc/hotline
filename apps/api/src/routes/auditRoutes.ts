import { Router } from "express";
import { auditController } from "@/controllers/AuditController.js";
import { requireWebAuth } from "@/middleware/auth.js";
import { asyncErrorWrapper } from "@/middleware/asyncErrorWrapper.js";

export const auditRoutes = Router();

auditRoutes.use(requireWebAuth);
auditRoutes.get("/", asyncErrorWrapper((req, res) => auditController.list(req, res)));
