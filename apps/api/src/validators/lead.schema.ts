import { z } from "zod";
import { convertLeadToCrmSchema, stopListLeadSchema } from "@hotline/shared";

export { convertLeadToCrmSchema, stopListLeadSchema };

export const listLeadsQuerySchema = z.object({
  stopListed: z.coerce.boolean().optional(),
});

export const searchBitrixUsersQuerySchema = z.object({
  query: z.string().trim().max(200).default(""),
});

export const conversionStatsQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});
