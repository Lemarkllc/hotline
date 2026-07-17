import { Router } from "express";
import { appealRoutes } from "@/routes/appealRoutes.js";
import { attachmentRoutes } from "@/routes/attachmentRoutes.js";
import { auditRoutes } from "@/routes/auditRoutes.js";
import { authRoutes } from "@/routes/authRoutes.js";
import { epicRoutes } from "@/routes/epicRoutes.js";
import { notificationRoutes } from "@/routes/notificationRoutes.js";
import { reportRoutes } from "@/routes/reportRoutes.js";
import { userRoutes } from "@/routes/userRoutes.js";

export const apiV1Router = Router();

apiV1Router.use("/auth", authRoutes);
apiV1Router.use("/users", userRoutes);
apiV1Router.use("/appeals", appealRoutes);
apiV1Router.use("/attachments", attachmentRoutes);
apiV1Router.use("/epics", epicRoutes);
apiV1Router.use("/reports", reportRoutes);
apiV1Router.use("/notifications", notificationRoutes);
apiV1Router.use("/audit", auditRoutes);
