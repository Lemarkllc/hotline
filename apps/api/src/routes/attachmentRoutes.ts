import { Router } from "express";
import multer from "multer";
import { attachmentController } from "@/controllers/AttachmentController.js";
import { requireBotService } from "@/middleware/auth.js";
import { asyncErrorWrapper } from "@/middleware/asyncErrorWrapper.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

export const attachmentRoutes = Router();

attachmentRoutes.post(
  "/",
  requireBotService("EMPLOYEE"),
  upload.single("file"),
  asyncErrorWrapper((req, res) => attachmentController.uploadDraft(req, res)),
);

attachmentRoutes.delete(
  "/:id",
  requireBotService("EMPLOYEE"),
  asyncErrorWrapper((req, res) => attachmentController.removeDraft(req, res)),
);
