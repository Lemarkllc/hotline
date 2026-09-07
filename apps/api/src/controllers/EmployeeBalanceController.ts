import type { Request, Response } from "express";
import type { z } from "zod";
import { BaseController } from "@/controllers/BaseController.js";
import { employeeBalanceService } from "@/services/employeeBalanceService.js";
import { pathParam } from "@/utils/params.js";
import type { updateEmployeeBalanceSchema } from "@/validators/employeeBalance.schema.js";

export class EmployeeBalanceController extends BaseController {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const employees = await employeeBalanceService.list(req.user!);
      this.handleSuccess(res, employees);
    } catch (error) {
      this.handleError(error, res, "employeeBalance.list");
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body as z.infer<typeof updateEmployeeBalanceSchema>;
      const employee = await employeeBalanceService.updateBalance(req.user!, pathParam(req, "id"), data);
      this.handleSuccess(res, employee);
    } catch (error) {
      this.handleError(error, res, "employeeBalance.update");
    }
  }
}

export const employeeBalanceController = new EmployeeBalanceController();
