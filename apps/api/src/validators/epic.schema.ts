import { z } from "zod";
import { CHANNELS } from "@hotline/shared";

export const listEpicsQuerySchema = z.object({
  channel: z.enum(CHANNELS).default("EMPLOYEE"),
  includeInactive: z.coerce.boolean().default(false),
});

export const createEpicSchema = z.object({
  channel: z.enum(CHANNELS).default("EMPLOYEE"),
  name: z.string().trim().min(1).max(120),
});

export const setEpicActiveSchema = z.object({
  isActive: z.boolean(),
});
