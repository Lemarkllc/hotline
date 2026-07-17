import { randomUUID } from "node:crypto";
import "@/lib/bigintJson.js";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { config } from "@/config/unifiedConfig.js";
import { logger } from "@/lib/logger.js";
import { errorHandler } from "@/middleware/errorHandler.js";
import { apiV1Router } from "@/routes/index.js";

export const app = express();

app.use(helmet());
app.use(cors({ origin: config.cors.origins, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(pinoHttp({ logger }));

app.use((req, _res, next) => {
  req.requestId = req.header("x-request-id") ?? randomUUID();
  next();
});

app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/v1", apiV1Router);

app.use(errorHandler);
