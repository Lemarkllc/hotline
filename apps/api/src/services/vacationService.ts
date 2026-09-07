import { vacationRequestRepository, type VacationRequestWithUsers } from "@/repositories/VacationRequestRepository.js";
import { userRepository } from "@/repositories/UserRepository.js";
import { notificationService } from "@/services/notificationService.js";
import { auditService } from "@/services/auditService.js";
import { vacationBalanceService } from "@/services/vacationBalanceService.js";
import type { AuthenticatedUser } from "@/types/index.js";
import { ForbiddenError, NotFoundError, ValidationError } from "@/types/index.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function inclusiveDayCount(dateFrom: Date, dateTo: Date): number {
  return Math.round((dateTo.getTime() - dateFrom.getTime()) / MS_PER_DAY) + 1;
}

export interface VacationRequestDTO {
  id: string;
  publicNumber: string;
  user: { id: string; fullName: string };
  dateFrom: Date;
  dateTo: Date;
  comment: string | null;
  paid: boolean;
  status: string;
  decidedBy: { id: string; fullName: string } | null;
  decidedAt: Date | null;
  decisionReason: string | null;
  createdAt: Date;
}

function serialize(request: VacationRequestWithUsers): VacationRequestDTO {
  return {
    id: request.id,
    publicNumber: request.publicNumber,
    user: { id: request.user.id, fullName: request.user.fullName },
    dateFrom: request.dateFrom,
    dateTo: request.dateTo,
    comment: request.comment,
    paid: request.paid,
    status: request.status,
    decidedBy: request.decidedBy ? { id: request.decidedBy.id, fullName: request.decidedBy.fullName } : null,
    decidedAt: request.decidedAt,
    decisionReason: request.decisionReason,
    createdAt: request.createdAt,
  };
}

/**
 * «Отпуска» — доступ на вебе через requirePlainPermission("vacation.manage") на роуте
 * (см. middleware/rbac.ts), здесь, как и у leadService/appealService, повторно
 * проверяем — единственная реальная точка авторизации для мутаций, роут — грубый гейт.
 */
export class VacationService {
  private requireManage(user: AuthenticatedUser): void {
    if (!user.permissions.includes("vacation.manage")) {
      throw new ForbiddenError("Недостаточно прав для работы с заявками на отпуск");
    }
  }

  /** Подаётся ботом от имени сотрудника по telegramId — тем же принципом, что и
   * leadService/appealService для бот-эндпоинтов: сервис сам резолвит User.
   * Для paid=true — валидация против баланса; если баланс ещё не настроен для
   * этого сотрудника (null, не 0 — см. vacationBalanceService), проверку
   * пропускаем: HRD решает вручную, как и для paid=false (за свой счёт). */
  async createFromBot(
    telegramId: bigint,
    data: { dateFrom: Date; dateTo: Date; comment?: string; paid: boolean },
  ): Promise<VacationRequestDTO> {
    const user = await userRepository.findByTelegramId(telegramId);
    if (!user) throw new NotFoundError("Пользователь не найден");
    if (data.dateTo < data.dateFrom) throw new ValidationError("Дата окончания раньше даты начала");

    if (data.paid) {
      const available = await vacationBalanceService.getAvailableDays(user.id);
      if (available !== null) {
        const requestedDays = inclusiveDayCount(data.dateFrom, data.dateTo);
        if (requestedDays > available) {
          throw new ValidationError(`Недостаточно дней отпуска: запрошено ${requestedDays}, доступно ${available}`);
        }
      }
    }

    const request = await vacationRequestRepository.create({
      userId: user.id,
      telegramId,
      dateFrom: data.dateFrom,
      dateTo: data.dateTo,
      comment: data.comment,
      paid: data.paid,
    });
    await notificationService.notifyHrdNewVacationRequest(request.id, user.fullName);
    return serialize(request);
  }

  /** Кнопка «Узнать количество дней отпуска» внутри диалога бота (PLAN.md §10) —
   * null означает «баланс не настроен», бот должен показать это отдельным текстом,
   * а не числом 0 (см. vacationBalanceService.getAvailableDays). */
  async getAvailableDaysFromBot(telegramId: bigint): Promise<number | null> {
    const user = await userRepository.findByTelegramId(telegramId);
    if (!user) throw new NotFoundError("Пользователь не найден");
    return vacationBalanceService.getAvailableDays(user.id);
  }

  async list(user: AuthenticatedUser, status?: "PENDING" | "APPROVED" | "REJECTED"): Promise<VacationRequestDTO[]> {
    this.requireManage(user);
    const requests = await vacationRequestRepository.listAll(status);
    return requests.map(serialize);
  }

  async getById(user: AuthenticatedUser, id: string): Promise<VacationRequestDTO> {
    this.requireManage(user);
    const request = await vacationRequestRepository.findById(id);
    if (!request) throw new NotFoundError("Заявка не найдена");
    return serialize(request);
  }

  async approve(user: AuthenticatedUser, id: string): Promise<VacationRequestDTO> {
    this.requireManage(user);
    const request = await vacationRequestRepository.findById(id);
    if (!request) throw new NotFoundError("Заявка не найдена");
    if (request.status !== "PENDING") throw new ValidationError("Заявка уже рассмотрена");

    const updated = await vacationRequestRepository.decide(id, { status: "APPROVED", decidedById: user.id });
    await notificationService.notifyVacationDecision(request.userId, true);
    await auditService.record({
      actorId: user.id,
      action: "vacation_request.approved",
      objectType: "VacationRequest",
      objectId: request.id,
      result: "success",
    });
    return serialize(updated);
  }

  async reject(user: AuthenticatedUser, id: string, reason: string): Promise<VacationRequestDTO> {
    this.requireManage(user);
    const request = await vacationRequestRepository.findById(id);
    if (!request) throw new NotFoundError("Заявка не найдена");
    if (request.status !== "PENDING") throw new ValidationError("Заявка уже рассмотрена");

    const updated = await vacationRequestRepository.decide(id, {
      status: "REJECTED",
      decidedById: user.id,
      decisionReason: reason,
    });
    await notificationService.notifyVacationDecision(request.userId, false);
    await auditService.record({
      actorId: user.id,
      action: "vacation_request.rejected",
      objectType: "VacationRequest",
      objectId: request.id,
      result: "success",
      reason,
    });
    return serialize(updated);
  }
}

export const vacationService = new VacationService();
