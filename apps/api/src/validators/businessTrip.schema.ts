import { z } from "zod";
import {
  createBusinessTripRequestSchema,
  refineBusinessTripRules,
  rejectHrRequestSchema,
  VACATION_STATUSES,
} from "@hotline/shared";

export { rejectHrRequestSchema };

const telegramIdField = z.union([z.string(), z.number()]).transform((v) => String(v));

/** «Командировка» — тот же приём .extend()+.superRefine(), что и у vacation.schema.ts. */
export const createBusinessTripRequestBotSchema = createBusinessTripRequestSchema
  .extend({ telegramId: telegramIdField })
  .superRefine(refineBusinessTripRules);

export const listBusinessTripRequestsQuerySchema = z.object({
  status: z.enum(VACATION_STATUSES).optional(),
});
