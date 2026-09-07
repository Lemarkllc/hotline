import { z } from "zod";

export const updateEmployeeBalanceSchema = z.object({
  hireDate: z.coerce.date().nullable().optional(),
  startingBalance: z.number().min(0).optional(),
  balanceAsOfDate: z.coerce.date().optional(),
});
