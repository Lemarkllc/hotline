import { vacationRequestRepository, type VacationRequestWithUsers } from "@/repositories/VacationRequestRepository.js";
import { userRepository } from "@/repositories/UserRepository.js";
import { notificationService } from "@/services/notificationService.js";
import { auditService } from "@/services/auditService.js";
import { vacationBalanceService } from "@/services/vacationBalanceService.js";
import { getPresignedDownloadUrl } from "@/lib/storage.js";
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
  applicationDrafted: boolean;
  applicationSigned: boolean;
  processedBy: { id: string; fullName: string } | null;
  processedAt: Date | null;
  attachments: { id: string; kind: string; mimeType: string; fileSize: number; createdAt: Date }[];
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
    applicationDrafted: request.applicationDrafted,
    applicationSigned: request.applicationSigned,
    processedBy: request.processedBy ? { id: request.processedBy.id, fullName: request.processedBy.fullName } : null,
    processedAt: request.processedAt,
    attachments: request.attachments.map((a) => ({
      id: a.id,
      kind: a.kind,
      mimeType: a.mimeType,
      fileSize: a.fileSize,
      createdAt: a.createdAt,
    })),
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

  /** Стадия «Оформление» (роль HR) — доступна и HR (hr.process), и HRD (vacation.manage,
   * сохраняет надзор). Отдельно от requireManage — approve/reject остаются только HRD. */
  private requireProcess(user: AuthenticatedUser): void {
    if (!user.permissions.includes("hr.process") && !user.permissions.includes("vacation.manage")) {
      throw new ForbiddenError("Недостаточно прав для оформления заявки на отпуск");
    }
  }

  /** Подаётся ботом от имени сотрудника по telegramId — тем же принципом, что и
   * leadService/appealService для бот-эндпоинтов: сервис сам резолвит User.
   * Для paid=true — валидация против баланса; если баланс ещё не настроен для
   * этого сотрудника (null, не 0 — см. vacationBalanceService), проверку
   * пропускаем: HRD решает вручную, как и для paid=false (за свой счёт). */
  async createFromBot(
    telegramId: bigint,
    data: { dateFrom: Date; dateTo: Date; comment?: string; paid: boolean; attachmentIds: string[] },
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
      attachmentIds: data.attachmentIds,
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

  async list(
    user: AuthenticatedUser,
    status?: "PENDING" | "APPROVED" | "REJECTED",
    processed?: boolean,
  ): Promise<VacationRequestDTO[]> {
    this.requireProcess(user);
    const requests = await vacationRequestRepository.listAll(status, processed);
    return requests.map(serialize);
  }

  async getById(user: AuthenticatedUser, id: string): Promise<VacationRequestDTO> {
    this.requireProcess(user);
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
    await notificationService.notifyHrVacationAwaitingProcessing(request.id, updated.user.fullName);
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

  /** Чек-лист стадии «Оформление» — только пока одобрено и ещё не оформлено. */
  async updateChecklist(
    user: AuthenticatedUser,
    id: string,
    data: { applicationDrafted?: boolean; applicationSigned?: boolean },
  ): Promise<VacationRequestDTO> {
    this.requireProcess(user);
    const request = await vacationRequestRepository.findById(id);
    if (!request) throw new NotFoundError("Заявка не найдена");
    if (request.status !== "APPROVED") throw new ValidationError("Оформление доступно только для одобренных заявок");
    if (request.processedAt) throw new ValidationError("Заявка уже оформлена");

    const updated = await vacationRequestRepository.updateChecklist(id, data);
    return serialize(updated);
  }

  /** Кнопка «Оформить» — требует оба пункта чек-листа, необратима (processedAt не сбрасывается). */
  async process(user: AuthenticatedUser, id: string): Promise<VacationRequestDTO> {
    this.requireProcess(user);
    const request = await vacationRequestRepository.findById(id);
    if (!request) throw new NotFoundError("Заявка не найдена");
    if (request.status !== "APPROVED") throw new ValidationError("Оформление доступно только для одобренных заявок");
    if (request.processedAt) throw new ValidationError("Заявка уже оформлена");
    if (!request.applicationDrafted || !request.applicationSigned) {
      throw new ValidationError("Отметьте оба пункта чек-листа перед оформлением");
    }

    const updated = await vacationRequestRepository.process(id, user.id);
    await notificationService.notifyVacationProcessed(request.userId);
    await auditService.record({
      actorId: user.id,
      action: "vacation_request.processed",
      objectType: "VacationRequest",
      objectId: request.id,
      result: "success",
    });
    return serialize(updated);
  }

  /** Фото заявления — та же схема, что appealService.getAttachmentUrl, доступ
   * ограничен тем же кругом, что и чтение самой заявки (requireProcess). */
  async getAttachmentUrl(
    user: AuthenticatedUser,
    vacationRequestId: string,
    attachmentId: string,
    forceDownload = false,
  ) {
    this.requireProcess(user);
    const request = await vacationRequestRepository.findById(vacationRequestId);
    if (!request) throw new NotFoundError("Заявка не найдена");
    const attachment = request.attachments.find((a) => a.id === attachmentId);
    if (!attachment) throw new NotFoundError("Вложение не найдено");
    return getPresignedDownloadUrl(attachment.storageKey, { forceDownload });
  }
}

export const vacationService = new VacationService();
