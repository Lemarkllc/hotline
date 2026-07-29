import { Router } from "express";
import { ratingSchema } from "@hotline/shared";
import { appealController } from "@/controllers/AppealController.js";
import { userController } from "@/controllers/UserController.js";
import { requireBotService, requireWebAuth } from "@/middleware/auth.js";
import { requirePermission } from "@/middleware/rbac.js";
import { asyncErrorWrapper } from "@/middleware/asyncErrorWrapper.js";
import { validate } from "@/middleware/validate.js";
import {
  assignSchema,
  botCreateMessageSchema,
  changeStatusSchema,
  createAppealBotSchema,
  createCommentSchema,
  listAppealsQuerySchema,
  myAppealsQuerySchema,
  revealAuthorSchema,
  setEpicSchema,
  workingEditSchema,
} from "@/validators/appeal.schema.js";
import { z } from "zod";

export const appealRoutes = Router();

// --- bot-employee (действует от имени telegramId) ---
appealRoutes.post(
  "/",
  requireBotService("EMPLOYEE"),
  validate(createAppealBotSchema),
  asyncErrorWrapper((req, res) => appealController.createFromBot(req, res)),
);

appealRoutes.get(
  "/mine",
  requireBotService("EMPLOYEE"),
  validate(myAppealsQuerySchema, "query"),
  asyncErrorWrapper((req, res) => appealController.listMineFromBot(req, res)),
);

appealRoutes.get(
  "/mine/:id",
  requireBotService("EMPLOYEE"),
  validate(z.object({ telegramId: z.union([z.string(), z.number()]).transform(String) }), "query"),
  asyncErrorWrapper((req, res) => appealController.getMineDetailFromBot(req, res)),
);

appealRoutes.post(
  "/:id/messages",
  requireBotService("EMPLOYEE"),
  validate(botCreateMessageSchema),
  asyncErrorWrapper((req, res) => appealController.addAuthorReplyFromBot(req, res)),
);

appealRoutes.post(
  "/:id/rating",
  requireBotService("EMPLOYEE"),
  validate(ratingSchema.extend({ telegramId: z.union([z.string(), z.number()]).transform(String) })),
  asyncErrorWrapper((req, res) => appealController.setRatingFromBot(req, res)),
);

// --- web (HRD / менеджер) ---
appealRoutes.get(
  "/",
  requireWebAuth,
  validate(listAppealsQuerySchema, "query"),
  asyncErrorWrapper((req, res) => appealController.list(req, res)),
);

// Должен идти раньше "/:id", иначе express примет "assignable-users" за :id.
appealRoutes.get(
  "/assignable-users",
  requireWebAuth,
  requirePermission("appeal.assign"),
  asyncErrorWrapper((req, res) => userController.listAssignable(req, res)),
);

appealRoutes.get(
  "/:id",
  requireWebAuth,
  asyncErrorWrapper((req, res) => appealController.getById(req, res)),
);

appealRoutes.post(
  "/:id/reveal-author",
  requireWebAuth,
  validate(revealAuthorSchema),
  asyncErrorWrapper((req, res) => appealController.revealAuthor(req, res)),
);

appealRoutes.patch(
  "/:id/status",
  requireWebAuth,
  validate(changeStatusSchema),
  asyncErrorWrapper((req, res) => appealController.changeStatus(req, res)),
);

appealRoutes.post(
  "/:id/assign",
  requireWebAuth,
  requirePermission("appeal.assign"),
  validate(assignSchema),
  asyncErrorWrapper((req, res) => appealController.assign(req, res)),
);

appealRoutes.post(
  "/:id/working-edit",
  requireWebAuth,
  validate(workingEditSchema),
  asyncErrorWrapper((req, res) => appealController.setWorkingEdit(req, res)),
);

appealRoutes.post(
  "/:id/epic",
  requireWebAuth,
  validate(setEpicSchema),
  asyncErrorWrapper((req, res) => appealController.setEpic(req, res)),
);

appealRoutes.post(
  "/:id/comments",
  requireWebAuth,
  validate(createCommentSchema),
  asyncErrorWrapper((req, res) => appealController.addComment(req, res)),
);

appealRoutes.get(
  "/:id/attachments/:attachmentId/url",
  requireWebAuth,
  asyncErrorWrapper((req, res) => appealController.getAttachmentUrl(req, res)),
);
