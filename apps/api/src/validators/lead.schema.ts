import { z } from "zod";
import { convertLeadToCrmSchema, stopListLeadSchema } from "@hotline/shared";

export { convertLeadToCrmSchema, stopListLeadSchema };

export const listLeadsQuerySchema = z.object({
  // "active" — реально в работе (NEW/IN_PROGRESS). CONVERTED — финальный статус,
  // как и STOP_LISTED, поэтому у него свой вид, а не "всё, кроме стоп-листа"
  // (см. EmailLeadRepository.list).
  view: z.enum(["active", "converted", "stop_listed"]).optional().default("active"),
});

export const searchBitrixUsersQuerySchema = z.object({
  query: z.string().trim().max(200).default(""),
});

export const conversionStatsQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});
