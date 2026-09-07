import { z } from "zod";
import { createAbsenceRequestSchema, refineAbsenceTimeRange, rejectHrRequestSchema, VACATION_STATUSES } from "@hotline/shared";

export { rejectHrRequestSchema };

const telegramIdField = z.union([z.string(), z.number()]).transform((v) => String(v));

/** «Отсутствие» — тот же приём .extend()+.superRefine(), что и у vacation.schema.ts. */
export const createAbsenceRequestBotSchema = createAbsenceRequestSchema
  .extend({ telegramId: telegramIdField })
  .superRefine(refineAbsenceTimeRange);

export const listAbsenceRequestsQuerySchema = z.object({
  status: z.enum(VACATION_STATUSES).optional(),
});
