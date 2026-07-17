import { Router } from "express";
import { userController } from "@/controllers/UserController.js";
import { requireWebAuth } from "@/middleware/auth.js";
import { requirePermission } from "@/middleware/rbac.js";
import { asyncErrorWrapper } from "@/middleware/asyncErrorWrapper.js";
import { validate } from "@/middleware/validate.js";
import {
  blockUserSchema,
  createWebAccountSchema,
  decideAccessRequestSchema,
} from "@/validators/user.schema.js";

export const userRoutes = Router();

userRoutes.use(requireWebAuth, requirePermission("user.manage"));

userRoutes.get("/", asyncErrorWrapper((req, res) => userController.list(req, res)));
userRoutes.get(
  "/access-requests",
  asyncErrorWrapper((req, res) => userController.listAccessRequests(req, res)),
);
userRoutes.post(
  "/access-requests/:id/approve",
  asyncErrorWrapper((req, res) => userController.approve(req, res)),
);
userRoutes.post(
  "/access-requests/:id/reject",
  validate(decideAccessRequestSchema),
  asyncErrorWrapper((req, res) => userController.reject(req, res)),
);
userRoutes.post(
  "/:id/block",
  validate(blockUserSchema),
  asyncErrorWrapper((req, res) => userController.block(req, res)),
);
userRoutes.post("/:id/archive", asyncErrorWrapper((req, res) => userController.archive(req, res)));
userRoutes.post(
  "/",
  validate(createWebAccountSchema),
  asyncErrorWrapper((req, res) => userController.createWebAccount(req, res)),
);
