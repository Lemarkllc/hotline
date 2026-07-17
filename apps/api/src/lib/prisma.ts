import { PrismaClient } from "@prisma/client";
import { config } from "@/config/unifiedConfig.js";

/** Единственный Prisma-клиент процесса. Репозитории — единственные потребители. */
export const prisma = new PrismaClient({
  log: config.isProduction ? ["error", "warn"] : ["error", "warn"],
});
