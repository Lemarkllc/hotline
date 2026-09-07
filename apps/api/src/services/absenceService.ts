import { absenceRequestRepository, type AbsenceRequestWithUsers } from "@/repositories/AbsenceRequestRepository.js";
import { userRepository } from "@/repositories/UserRepository.js";
import { notificationService } from "@/services/notificationService.js";
import { auditService } from "@/services/auditService.js";
import type { AuthenticatedUser } from "@/types/index.js";
import { ForbiddenError, NotFoundError, ValidationError } from "@/types/index.js";

export interface AbsenceRequestDTO {
  id: string;
  publicNumber: string;
  user: { id: string; fullName: string };
  date: Date;
  fullDay: boolean;
  timeFrom: string | null;
  timeTo: string | null;
  reason: string | null;
  status: string;
  decidedBy: { id: string; fullName: string } | null;
  decidedAt: Date | null;
  decisionReason: string | null;
  createdAt: Date;
}

function serialize(request: AbsenceRequestWithUsers): AbsenceRequestDTO {
  return {
    id: request.id,
    publicNumber: request.publicNumber,
    user: { id: request.user.id, fullName: request.user.fullName },
    date: request.date,
    fullDay: request.fullDay,
    timeFrom: request.timeFrom,
    timeTo: request.timeTo,
    reason: request.reason,
    status: request.status,
    decidedBy: request.decidedBy ? { id: request.decidedBy.id, fullName: request.decidedBy.fullName } : null,
    decidedAt: request.decidedAt,
    decisionReason: request.decisionReason,
    createdAt: request.createdAt,
  };
}

/**
 * «Отсутствие» (было TIME_OFF внутри Appeal, PLAN.md §10) — по образцу vacationService:
 * доступ на вебе через requirePlainPermission("vacation.manage") на роуте, здесь —
 * повторная проверка (единственная реальная точка авторизации для мутаций).
 */
export class AbsenceService {
  private requireManage(user: AuthenticatedUser): void {
    if (!user.permissions.includes("vacation.manage")) {
      throw new ForbiddenError("Недостаточно прав для работы с заявками на отсутствие");
    }
  }

  async createFromBot(
    telegramId: bigint,
    data: { date: Date; fullDay: boolean; timeFrom?: string; timeTo?: string; reason?: string },
  ): Promise<AbsenceRequestDTO> {
    const user = await userRepository.findByTelegramId(telegramId);
    if (!user) throw new NotFoundError("Пользователь не найден");

    const request = await absenceRequestRepository.create({
      userId: user.id,
      telegramId,
      date: data.date,
      fullDay: data.fullDay,
      timeFrom: data.timeFrom,
      timeTo: data.timeTo,
      reason: data.reason,
    });
    await notificationService.notifyHrdNewAbsenceRequest(request.id, user.fullName);
    return serialize(request);
  }

  async list(user: AuthenticatedUser, status?: "PENDING" | "APPROVED" | "REJECTED"): Promise<AbsenceRequestDTO[]> {
    this.requireManage(user);
    const requests = await absenceRequestRepository.listAll(status);
    return requests.map(serialize);
  }

  async getById(user: AuthenticatedUser, id: string): Promise<AbsenceRequestDTO> {
    this.requireManage(user);
    const request = await absenceRequestRepository.findById(id);
    if (!request) throw new NotFoundError("Заявка не найдена");
    return serialize(request);
  }

  async approve(user: AuthenticatedUser, id: string): Promise<AbsenceRequestDTO> {
    this.requireManage(user);
    const request = await absenceRequestRepository.findById(id);
    if (!request) throw new NotFoundError("Заявка не найдена");
    if (request.status !== "PENDING") throw new ValidationError("Заявка уже рассмотрена");

    const updated = await absenceRequestRepository.decide(id, { status: "APPROVED", decidedById: user.id });
    await notificationService.notifyAbsenceDecision(request.userId, true);
    await auditService.record({
      actorId: user.id,
      action: "absence_request.approved",
      objectType: "AbsenceRequest",
      objectId: request.id,
      result: "success",
    });
    return serialize(updated);
  }

  async reject(user: AuthenticatedUser, id: string, reason: string): Promise<AbsenceRequestDTO> {
    this.requireManage(user);
    const request = await absenceRequestRepository.findById(id);
    if (!request) throw new NotFoundError("Заявка не найдена");
    if (request.status !== "PENDING") throw new ValidationError("Заявка уже рассмотрена");

    const updated = await absenceRequestRepository.decide(id, {
      status: "REJECTED",
      decidedById: user.id,
      decisionReason: reason,
    });
    await notificationService.notifyAbsenceDecision(request.userId, false);
    await auditService.record({
      actorId: user.id,
      action: "absence_request.rejected",
      objectType: "AbsenceRequest",
      objectId: request.id,
      result: "success",
      reason,
    });
    return serialize(updated);
  }
}

export const absenceService = new AbsenceService();
