import { z } from "zod";
import { CHANNELS } from "@hotline/shared";

export const reportQuerySchema = z.object({
  channel: z.enum(CHANNELS).default("EMPLOYEE"),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const exportQuerySchema = reportQuerySchema.extend({
  format: z.enum(["csv", "xlsx"]).default("csv"),
  includeAuthor: z.coerce.boolean().default(false),
});
