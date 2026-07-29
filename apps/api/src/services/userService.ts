import { randomBytes } from "node:crypto";
import type { Channel } from "@hotline/shared";
import { accessRequestRepository } from "@/repositories/AccessRequestRepository.js";
import { userRepository } from "@/repositories/UserRepository.js";
import { authService } from "@/services/authService.js";
import { auditService } from "@/services/auditService.js";
import { notificationService } from "@/services/notificationService.js";
import type { AuthenticatedUser } from "@/types/index.js";
import { ForbiddenError, NotFoundError, ValidationError } from "@/types/index.js";
import { sanitizeUser } from "@/utils/serializers.js";

export class UserService {
  async listAccessRequests() {
    const requests = await accessRequestRepository.listPending();
    return requests.map((r) => ({ ...r, user: sanitizeUser(r.user) }));
  }

  /**
   * Список "кому можно назначить обращение" (MANAGER + HRD канала) — используется
   * карточкой обращения. Отдельно от list()/user.manage: назначающий (appeal.assign,
   * то есть обычно HRD) не обязан иметь право на администрирование пользователей —
   * иначе HRD не смог бы назначать менеджеров, что прямо противоречит SRS §4.4.
   */
  async listAssignable(channel: Channel) {
    const [managers, hrds] = await Promise.all([
      userRepository.findByRoleAndChannel("MANAGER", channel),
      userRepository.findByRoleAndChannel("HRD", channel),
    ]);
    const seen = new Set<string>();
    return [...managers, ...hrds]
      .filter((u) => (seen.has(u.id) ? false : (seen.add(u.id), true)))
      .map(sanitizeUser);
  }

  async list(status?: string) {
    const users = await userRepository.list(status);
    return users.map((u) => {
      const { userRoles, ...user } = u;
      return { ...sanitizeUser(user), roleNames: userRoles.map((ur) => ur.role.name) };
    });
  }

  /**
   * Дополнение к FR-USR-003 (ОБТ, по просьбе): HRD тоже может подтвердить/отклонить
   * заявку, но только через бота (нет web-эндпоинта под этот путь) — Администратор
   * сохраняет свой web-путь без изменений. Проверка роли — здесь, а не в роуте:
   * requireBotService проверяет только "это бот", не "это HRD" (см. паттерн
   * epicService с прямой проверкой roleNames, CLAUDE.md "RBAC").
   */
  async approveAccessRequestFromBot(telegramId: bigint, requestId: string): Promise<void> {
    const actor = await this.requireHrdActor(telegramId);
    await this.approveAccessRequest(actor, requestId);
  }

  async rejectAccessRequestFromBot(telegramId: bigint, requestId: string, reason?: string): Promise<void> {
    const actor = await this.requireHrdActor(telegramId);
    await this.rejectAccessRequest(actor, requestId, reason);
  }

  private async requireHrdActor(telegramId: bigint): Promise<AuthenticatedUser> {
    const user = await userRepository.findByTelegramId(telegramId);
    if (!user) throw new NotFoundError("Пользователь не найден");
    const actor = await userRepository.getAuthContext(user.id);
    if (!actor || !actor.roleNames.includes("HRD")) {
      throw new ForbiddenError("Только HRD может подтверждать заявки из бота");
    }
    return actor;
  }

  /** FR-USR-003/FR-AUTH-005: только Администратор подтверждает/отклоняет заявку. */
  async approveAccessRequest(admin: AuthenticatedUser, requestId: string): Promise<void> {
    const request = await accessRequestRepository.findById(requestId);
    if (!request) throw new NotFoundError("Заявка не найдена");
    await accessRequestRepository.decide(requestId, { status: "ACTIVE", decidedById: admin.id });
    await userRepository.updateStatus(request.userId, "ACTIVE");
    await userRepository.grantChannelAccess(request.userId, "EMPLOYEE", admin.id);
    await notificationService.notifyAccessDecision(request.userId, true);
    await auditService.record({
      actorId: admin.id,
      action: "user.access_approved",
      objectType: "User",
      objectId: request.userId,
      result: "success",
    });
  }

  async rejectAccessRequest(admin: AuthenticatedUser, requestId: string, reason?: string): Promise<void> {
    const request = await accessRequestRepository.findById(requestId);
    if (!request) throw new NotFoundError("Заявка не найдена");
    await accessRequestRepository.decide(requestId, {
      status: "REJECTED",
      decidedById: admin.id,
      decisionReason: reason,
    });
    await userRepository.updateStatus(request.userId, "REJECTED");
    await notificationService.notifyAccessDecision(request.userId, false);
    await auditService.record({
      actorId: admin.id,
      action: "user.access_rejected",
      objectType: "User",
      objectId: request.userId,
      result: "success",
      reason,
    });
  }

  /** FR-USR-006/007: блокировка не удаляет историю — только статус + причина. */
  async blockUser(admin: AuthenticatedUser, userId: string, reason: string): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError("Пользователь не найден");
    await userRepository.blockUser(userId, reason);
    await auditService.record({
      actorId: admin.id,
      action: "user.blocked",
      objectType: "User",
      objectId: userId,
      result: "success",
      reason,
    });
  }

  async archiveUser(admin: AuthenticatedUser, userId: string): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError("Пользователь не найден");
    await userRepository.archiveUser(userId);
    await auditService.record({
      actorId: admin.id,
      action: "user.archived",
      objectType: "User",
      objectId: userId,
      result: "success",
    });
  }

  /** SRS §4.5 "Управлять ролями" — правка ФИО/привязки Telegram/ролей существующего
   * пользователя; раньше роль можно было задать только один раз, при создании. */
  async updateUser(
    admin: AuthenticatedUser,
    userId: string,
    data: { fullName?: string; telegramId?: string | null; roleNames?: string[] },
  ) {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError("Пользователь не найден");

    if (data.telegramId) {
      const existing = await userRepository.findByTelegramId(BigInt(data.telegramId));
      if (existing && existing.id !== userId) {
        throw new ValidationError("Этот Telegram-аккаунт уже привязан к другому пользователю");
      }
    }

    await userRepository.updateProfile(userId, {
      fullName: data.fullName,
      telegramId: data.telegramId === undefined ? undefined : data.telegramId === null ? null : BigInt(data.telegramId),
    });
    if (data.roleNames) {
      await userRepository.setRoles(userId, data.roleNames);
    }
    await auditService.record({
      actorId: admin.id,
      action: "user.updated",
      objectType: "User",
      objectId: userId,
      result: "success",
      metadata: { fullName: data.fullName, roleNames: data.roleNames, telegramLinked: data.telegramId !== undefined },
    });

    const updated = await userRepository.findByIdWithRoles(userId);
    const { userRoles, ...rest } = updated!;
    return { ...sanitizeUser(rest), roleNames: userRoles.map((ur) => ur.role.name) };
  }

  /** Сброс пароля Администратором — только для web-аккаунтов (с email). Новый временный
   * пароль возвращается один раз в ответе, чтобы Администратор передал его пользователю;
   * mustChangePassword=true заставит сменить его при следующем входе. */
  async resetPassword(admin: AuthenticatedUser, userId: string): Promise<{ temporaryPassword: string }> {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError("Пользователь не найден");
    if (!user.email) throw new ValidationError("Сброс пароля доступен только для web-аккаунтов (с email)");

    const temporaryPassword = randomBytes(9).toString("base64url");
    const passwordHash = await authService.hashPassword(temporaryPassword);
    await userRepository.resetPassword(userId, passwordHash);
    await auditService.record({
      actorId: admin.id,
      action: "user.password_reset",
      objectType: "User",
      objectId: userId,
      result: "success",
    });
    return { temporaryPassword };
  }

  /** Web-аккаунты создаёт Администратор вручную (PLAN.md §9, допущение №1). */
  async createWebAccount(
    admin: AuthenticatedUser,
    data: { email: string; fullName: string; temporaryPassword: string; roleNames: string[] },
  ) {
    const existing = await userRepository.findByEmail(data.email);
    if (existing) throw new ValidationError("Пользователь с таким email уже существует");

    const passwordHash = await authService.hashPassword(data.temporaryPassword);
    const user = await userRepository.createWebAccount({
      email: data.email,
      fullName: data.fullName,
      passwordHash,
      roleNames: data.roleNames,
    });
    await userRepository.grantChannelAccess(user.id, "EMPLOYEE", admin.id);
    await auditService.record({
      actorId: admin.id,
      action: "user.web_account_created",
      objectType: "User",
      objectId: user.id,
      result: "success",
      metadata: { roleNames: data.roleNames },
    });
    return sanitizeUser(user);
  }
}

export const userService = new UserService();
