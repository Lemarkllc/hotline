import { userRepository } from "@/repositories/UserRepository.js";
import { vacationBalanceService } from "@/services/vacationBalanceService.js";
import { auditService } from "@/services/auditService.js";
import type { AuthenticatedUser } from "@/types/index.js";
import { ForbiddenError, NotFoundError } from "@/types/index.js";

export interface EmployeeBalanceDTO {
  id: string;
  fullName: string;
  hireDate: Date | null;
  startingBalance: number | null;
  balanceAsOfDate: Date | null;
  /** null = баланс не настроен (нет hireDate или снимка) — не 0, см. vacationBalanceService. */
  availableDays: number | null;
}

/**
 * Даёт HRD (vacation.manage) узкий доступ к списку сотрудников — ТОЛЬКО чтобы
 * проставить дату приёма и стартовый остаток отпуска, без полного user.manage
 * (роли/блокировка/сброс пароля/каналы остаются администраторскими — тот же
 * принцип разделения, что у appeal.assign vs user.manage для /appeals/assignable-users).
 */
export class EmployeeBalanceService {
  private requireManage(user: AuthenticatedUser): void {
    if (!user.permissions.includes("vacation.manage")) {
      throw new ForbiddenError("Недостаточно прав для управления остатками отпусков");
    }
  }

  async list(user: AuthenticatedUser): Promise<EmployeeBalanceDTO[]> {
    this.requireManage(user);
    const users = await userRepository.list("ACTIVE");
    return Promise.all(
      users.map(async (u) => ({
        id: u.id,
        fullName: u.fullName,
        hireDate: u.hireDate,
        startingBalance: u.vacationBalance?.startingBalance ?? null,
        balanceAsOfDate: u.vacationBalance?.asOfDate ?? null,
        availableDays: await vacationBalanceService.getAvailableDays(u.id),
      })),
    );
  }

  async updateBalance(
    user: AuthenticatedUser,
    userId: string,
    data: { hireDate?: Date | null; startingBalance?: number; balanceAsOfDate?: Date },
  ): Promise<EmployeeBalanceDTO> {
    this.requireManage(user);
    const target = await userRepository.findById(userId);
    if (!target) throw new NotFoundError("Сотрудник не найден");

    await userRepository.updateProfile(userId, { hireDate: data.hireDate });
    // Оба поля обязательны вместе — стартовый остаток без даты снимка бессмысленен
    // для формулы (utils/vacationBalance.ts), тот же приём, что в userService.updateUser.
    if (data.startingBalance !== undefined && data.balanceAsOfDate !== undefined) {
      await userRepository.upsertVacationBalance(userId, {
        startingBalance: data.startingBalance,
        asOfDate: data.balanceAsOfDate,
      });
    }
    await auditService.record({
      actorId: user.id,
      action: "employee_balance.updated",
      objectType: "User",
      objectId: userId,
      result: "success",
    });

    const updated = await userRepository.findById(userId);
    const balance = await userRepository.findVacationBalance(userId);
    return {
      id: updated!.id,
      fullName: updated!.fullName,
      hireDate: updated!.hireDate,
      startingBalance: balance?.startingBalance ?? null,
      balanceAsOfDate: balance?.asOfDate ?? null,
      availableDays: await vacationBalanceService.getAvailableDays(userId),
    };
  }
}

export const employeeBalanceService = new EmployeeBalanceService();
