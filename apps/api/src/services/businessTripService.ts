import type { BusinessTripTransport } from "@prisma/client";
import {
  businessTripRequestRepository,
  type BusinessTripRequestWithUsers,
} from "@/repositories/BusinessTripRequestRepository.js";
import { userRepository } from "@/repositories/UserRepository.js";
import { notificationService } from "@/services/notificationService.js";
import { auditService } from "@/services/auditService.js";
import type { AuthenticatedUser } from "@/types/index.js";
import { ForbiddenError, NotFoundError, ValidationError } from "@/types/index.js";

export interface BusinessTripRequestDTO {
  id: string;
  publicNumber: string;
  user: { id: string; fullName: string };
  dateFrom: Date;
  dateTo: Date;
  purpose: string;
  transport: BusinessTripTransport;
  transportOther: string | null;
  hotelNeeded: boolean;
  status: string;
  decidedBy: { id: string; fullName: string } | null;
  decidedAt: Date | null;
  decisionReason: string | null;
  createdAt: Date;
}

function serialize(request: BusinessTripRequestWithUsers): BusinessTripRequestDTO {
  return {
    id: request.id,
    publicNumber: request.publicNumber,
    user: { id: request.user.id, fullName: request.user.fullName },
    dateFrom: request.dateFrom,
    dateTo: request.dateTo,
    purpose: request.purpose,
    transport: request.transport,
    transportOther: request.transportOther,
    hotelNeeded: request.hotelNeeded,
    status: request.status,
    decidedBy: request.decidedBy ? { id: request.decidedBy.id, fullName: request.decidedBy.fullName } : null,
    decidedAt: request.decidedAt,
    decisionReason: request.decisionReason,
    createdAt: request.createdAt,
  };
}

/** «Командировка» (PLAN.md §10) — по образцу vacationService/absenceService. */
export class BusinessTripService {
  private requireManage(user: AuthenticatedUser): void {
    if (!user.permissions.includes("vacation.manage")) {
      throw new ForbiddenError("Недостаточно прав для работы с заявками на командировку");
    }
  }

  async createFromBot(
    telegramId: bigint,
    data: {
      dateFrom: Date;
      dateTo: Date;
      purpose: string;
      transport: BusinessTripTransport;
      transportOther?: string;
      hotelNeeded: boolean;
    },
  ): Promise<BusinessTripRequestDTO> {
    const user = await userRepository.findByTelegramId(telegramId);
    if (!user) throw new NotFoundError("Пользователь не найден");
    if (data.dateTo < data.dateFrom) throw new ValidationError("Дата окончания раньше даты начала");

    const request = await businessTripRequestRepository.create({
      userId: user.id,
      telegramId,
      dateFrom: data.dateFrom,
      dateTo: data.dateTo,
      purpose: data.purpose,
      transport: data.transport,
      transportOther: data.transportOther,
      hotelNeeded: data.hotelNeeded,
    });
    await notificationService.notifyHrdNewBusinessTripRequest(request.id, user.fullName);
    return serialize(request);
  }

  async list(user: AuthenticatedUser, status?: "PENDING" | "APPROVED" | "REJECTED"): Promise<BusinessTripRequestDTO[]> {
    this.requireManage(user);
    const requests = await businessTripRequestRepository.listAll(status);
    return requests.map(serialize);
  }

  async getById(user: AuthenticatedUser, id: string): Promise<BusinessTripRequestDTO> {
    this.requireManage(user);
    const request = await businessTripRequestRepository.findById(id);
    if (!request) throw new NotFoundError("Заявка не найдена");
    return serialize(request);
  }

  async approve(user: AuthenticatedUser, id: string): Promise<BusinessTripRequestDTO> {
    this.requireManage(user);
    const request = await businessTripRequestRepository.findById(id);
    if (!request) throw new NotFoundError("Заявка не найдена");
    if (request.status !== "PENDING") throw new ValidationError("Заявка уже рассмотрена");

    const updated = await businessTripRequestRepository.decide(id, { status: "APPROVED", decidedById: user.id });
    await notificationService.notifyBusinessTripDecision(request.userId, true);
    await auditService.record({
      actorId: user.id,
      action: "business_trip_request.approved",
      objectType: "BusinessTripRequest",
      objectId: request.id,
      result: "success",
    });
    return serialize(updated);
  }

  async reject(user: AuthenticatedUser, id: string, reason: string): Promise<BusinessTripRequestDTO> {
    this.requireManage(user);
    const request = await businessTripRequestRepository.findById(id);
    if (!request) throw new NotFoundError("Заявка не найдена");
    if (request.status !== "PENDING") throw new ValidationError("Заявка уже рассмотрена");

    const updated = await businessTripRequestRepository.decide(id, {
      status: "REJECTED",
      decidedById: user.id,
      decisionReason: reason,
    });
    await notificationService.notifyBusinessTripDecision(request.userId, false);
    await auditService.record({
      actorId: user.id,
      action: "business_trip_request.rejected",
      objectType: "BusinessTripRequest",
      objectId: request.id,
      result: "success",
      reason,
    });
    return serialize(updated);
  }
}

export const businessTripService = new BusinessTripService();
