import { z } from "zod";
import { convertLeadToCrmSchema, stopListLeadSchema } from "@hotline/shared";

export { convertLeadToCrmSchema, stopListLeadSchema };

export const listLeadsQuerySchema = z.object({
  // z.coerce.boolean() трактует ЛЮБУЮ непустую строку как true, включая буквальное
  // "false" из query-параметра (?stopListed=false) — из-за этого вкладка "Активные"
  // на фронте (useLeads(false) → ?stopListed=false) фактически запрашивала стоп-лист.
  stopListed: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export const searchBitrixUsersQuerySchema = z.object({
  query: z.string().trim().max(200).default(""),
});

export const conversionStatsQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});
