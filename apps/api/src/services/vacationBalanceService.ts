import { userRepository } from "@/repositories/UserRepository.js";
import { vacationRequestRepository } from "@/repositories/VacationRequestRepository.js";
import { calculateAvailableVacationDays } from "@/utils/vacationBalance.js";

/**
 * Композиция чистой формулы (utils/vacationBalance.ts) с реальными данными
 * пользователя (PLAN.md §10). Nameренно отдельный сервис, не метод внутри
 * vacationService — переиспользуется ботом (кнопка "узнать количество дней"),
 * веб-отображением остатка и валидацией оплачиваемого отпуска при подаче заявки.
 */
export class VacationBalanceService {
  /** null — баланс ещё не настроен (нет hireDate или нет стартового снимка), а не 0
   * дней: прямое решение из /grill-me — не показывать правдоподобный, но неверный 0. */
  async getAvailableDays(userId: string): Promise<number | null> {
    const [user, balance] = await Promise.all([
      userRepository.findById(userId),
      userRepository.findVacationBalance(userId),
    ]);
    if (!user?.hireDate || !balance) return null;

    const usedPaidDaysSinceAsOfDate = await vacationRequestRepository.sumApprovedPaidDaysSince(
      userId,
      balance.asOfDate,
    );

    return calculateAvailableVacationDays({
      hireDate: user.hireDate,
      startingBalance: balance.startingBalance,
      asOfDate: balance.asOfDate,
      usedPaidDaysSinceAsOfDate,
    });
  }
}

export const vacationBalanceService = new VacationBalanceService();
