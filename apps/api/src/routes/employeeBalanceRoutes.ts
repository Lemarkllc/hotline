import { Router } from "express";
import { employeeBalanceController } from "@/controllers/EmployeeBalanceController.js";
import { requireWebAuth } from "@/middleware/auth.js";
import { requirePlainPermission } from "@/middleware/rbac.js";
import { asyncErrorWrapper } from "@/middleware/asyncErrorWrapper.js";
import { validate } from "@/middleware/validate.js";
import { updateEmployeeBalanceSchema } from "@/validators/employeeBalance.schema.js";

/** Узкий HRD-доступ к сотрудникам (только дата приёма + остаток отпуска) — отдельно
 * от /users (user.manage, Администратор), тот же принцип разделения, что у
 * /appeals/assignable-users vs /users. Гейт requirePlainPermission("vacation.manage") —
 * та же самая подсистема "Отпуска", не канало-скоуплен (см. middleware/rbac.ts). */
export const employeeBalanceRoutes = Router();

employeeBalanceRoutes.get(
  "/",
  requireWebAuth,
  requirePlainPermission("vacation.manage"),
  asyncErrorWrapper((req, res) => employeeBalanceController.list(req, res)),
);

employeeBalanceRoutes.patch(
  "/:id/balance",
  requireWebAuth,
  requirePlainPermission("vacation.manage"),
  validate(updateEmployeeBalanceSchema),
  asyncErrorWrapper((req, res) => employeeBalanceController.update(req, res)),
);
