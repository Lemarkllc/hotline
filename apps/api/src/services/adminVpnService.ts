import type { User, VpnProfile } from "@prisma/client";
import { isValidFullName, FULL_NAME_FORMAT_HINT } from "@hotline/shared";
import { logger } from "@/lib/logger.js";
import { VPN_PROFILE_HWID_LIMIT } from "@/config/vpnConfig.js";
import { accessRequestRepository } from "@/repositories/AccessRequestRepository.js";
import { userRepository } from "@/repositories/UserRepository.js";
import { vpnProfileRepository } from "@/repositories/VpnProfileRepository.js";
import { vpnUsageSnapshotRepository } from "@/repositories/VpnUsageSnapshotRepository.js";
import { auditService } from "@/services/auditService.js";
import { emailSendService } from "@/services/emailSendService.js";
import { userService } from "@/services/userService.js";
import { vpnPanelService, type VpnPanelClientSummary } from "@/services/vpnPanelService.js";
import { toDeviceView, vpnService, type VpnDeviceView } from "@/services/vpnService.js";
import { vpnConnectorUrl } from "@/templates/vpnAccess.js";
import type { AuthenticatedUser } from "@/types/index.js";
import { ConflictError, HttpError, NotFoundError, ValidationError } from "@/types/index.js";
import { trafficOverWindow, type VpnUsagePoint } from "@/utils/vpnTraffic.js";

/** «есть» / «нет» / «ссылка устарела» / «отключён администратором». */
export type AdminVpnState = "ACTIVE" | "NONE" | "STALE" | "DISABLED";

export interface AdminVpnRow {
  userId: string;
  fullName: string;
  telegramId: string;
  email: string | null;
  state: AdminVpnState;
  panelEmail: string | null;
  deviceLimit: number | null;
  /** Устройства из последнего ночного снимка; null — снимка ещё нет. */
  devices: { count: number; at: string } | null;
  traffic30: { bytes: number; days: number; since: string | null; full: boolean };
  /** Текущие счётчики панели (основной + вспомогательные); null — панель недоступна или VPN нет. */
  trafficTotal: number | null;
}

export interface AdminVpnListDTO {
  rows: AdminVpnRow[];
  /** false — панель не ответила: состояния «есть/устарела» и «всего» неизвестны. */
  panelAvailable: boolean;
}

export interface AdminVpnCardDTO {
  row: AdminVpnRow;
  subscriptionUrl: string | null;
  connectorUrl: string | null;
  /** Живые устройства с панели; null — VPN нет или ссылка устарела. */
  liveDevices: VpnDeviceView[] | null;
}

export type AddEmployeeOutcome = "created" | "approved" | "reactivated" | "already_active";

const TRAFFIC_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

type ProfileWithAux = VpnProfile & { awgAuxClients: { panelEmail: string }[] };

function profileState(user: User, profile: ProfileWithAux | undefined, panelByEmail: Map<string, VpnPanelClientSummary> | null): AdminVpnState {
  if (user.vpnDisabledAt) return "DISABLED";
  if (!profile) return "NONE";
  if (!panelByEmail) return "ACTIVE";
  return panelByEmail.get(profile.panelEmail)?.subId === profile.subId ? "ACTIVE" : "STALE";
}

/** Раздел «VPN» Администратора (openspec admin-vpn-management). Права — user.manage на
 * маршруте; все действия — в аудит, без ссылок и ключей. */
export class AdminVpnService {
  async list(now = new Date()): Promise<AdminVpnListDTO> {
    const users = await userRepository.listActiveTelegramUsers();
    const profiles = new Map((await vpnProfileRepository.findAllActive()).map((p) => [p.userId, p]));

    let panelByEmail: Map<string, VpnPanelClientSummary> | null = null;
    try {
      panelByEmail = new Map((await vpnPanelService.listAllClients()).map((c) => [c.email, c]));
    } catch (error) {
      logger.warn({ err: error }, "adminVpnService: панель не ответила на clients/list");
    }

    const since = new Date(now.getTime() - (TRAFFIC_WINDOW_DAYS + 1) * DAY_MS);
    const snapshots = await vpnUsageSnapshotRepository.listSinceForUsers(
      users.map((u) => u.id),
      since,
    );
    const pointsByUser = new Map<string, Map<number, VpnUsagePoint>>();
    const lastSnapshotByUser = new Map<string, (typeof snapshots)[number]>();
    for (const s of snapshots) {
      const byDay = pointsByUser.get(s.profile.userId) ?? new Map<number, VpnUsagePoint>();
      const prev = byDay.get(s.day.getTime());
      byDay.set(s.day.getTime(), { day: s.day, total: (prev?.total ?? 0n) + s.upBytes + s.downBytes });
      pointsByUser.set(s.profile.userId, byDay);
      lastSnapshotByUser.set(s.profile.userId, s);
    }

    const rows = users.map((user): AdminVpnRow => {
      const profile = profiles.get(user.id);
      const state = profileState(user, profile, panelByEmail);
      const last = profile ? lastSnapshotByUser.get(user.id) : undefined;
      const window = trafficOverWindow([...(pointsByUser.get(user.id)?.values() ?? [])], TRAFFIC_WINDOW_DAYS, now);

      let trafficTotal: number | null = null;
      if (profile && panelByEmail && state === "ACTIVE") {
        trafficTotal = [profile.panelEmail, ...profile.awgAuxClients.map((a) => a.panelEmail)].reduce((sum, email) => {
          const c = panelByEmail!.get(email);
          return sum + (c ? c.up + c.down : 0);
        }, 0);
      }

      return {
        userId: user.id,
        fullName: user.fullName,
        telegramId: String(user.telegramId),
        email: user.email,
        state,
        panelEmail: profile?.panelEmail ?? null,
        deviceLimit: profile?.deviceLimit ?? null,
        devices: last && last.profileId === profile?.id ? { count: last.deviceCount, at: last.takenAt.toISOString() } : null,
        traffic30: { bytes: Number(window.bytes), days: window.days, since: window.since?.toISOString() ?? null, full: window.full },
        trafficTotal,
      };
    });

    return { rows, panelAvailable: panelByEmail !== null };
  }

  async getCard(userId: string): Promise<AdminVpnCardDTO> {
    const { rows } = await this.list();
    const row = rows.find((r) => r.userId === userId);
    if (!row) throw new NotFoundError("Сотрудник не найден");

    const profile = await vpnProfileRepository.findActiveByUserId(userId);
    if (!profile || row.state !== "ACTIVE") {
      return { row, subscriptionUrl: null, connectorUrl: null, liveDevices: null };
    }
    const subscriptionUrl = vpnService.getSubscriptionUrl(profile.subId);
    let liveDevices: VpnDeviceView[] | null = null;
    try {
      liveDevices = (await vpnPanelService.listDevices(profile.panelEmail)).map(toDeviceView);
    } catch (error) {
      logger.warn({ err: error, panelEmail: profile.panelEmail }, "adminVpnService: устройства не получены");
    }
    return { row, subscriptionUrl, connectorUrl: vpnConnectorUrl(subscriptionUrl), liveDevices };
  }

  /** Добавление сотрудника по Telegram ID (таблица состояний в спеке): сразу активен,
   * канал EMPLOYEE, VPN выдан. Сообщений в Telegram нет. */
  async addEmployee(
    admin: AuthenticatedUser,
    input: { telegramId: bigint; fullName: string; email?: string | null; deviceLimit?: number },
  ): Promise<{ userId: string; outcome: AddEmployeeOutcome }> {
    const fullName = input.fullName.trim().replace(/\s+/g, " ");
    if (!isValidFullName(fullName)) throw new ValidationError(FULL_NAME_FORMAT_HINT);
    const email = input.email?.trim().toLowerCase() || null;
    const deviceLimit = input.deviceLimit ?? VPN_PROFILE_HWID_LIMIT;

    const existing = await userRepository.findByTelegramId(input.telegramId);
    if (existing && (existing.status === "BLOCKED" || existing.status === "ARCHIVED")) {
      throw new ConflictError("Сотрудник заблокирован — сначала разблокируйте его в «Пользователях»");
    }
    // Email проверяем ДО любых изменений, чтобы занятый адрес не оставил полудобавленного сотрудника.
    if (email) await this.assertEmailFree(email, existing?.id ?? null);

    let user: User;
    let outcome: AddEmployeeOutcome;
    if (!existing) {
      user = await userRepository.createTelegramEmployee({ telegramId: input.telegramId, fullName, email });
      await userRepository.grantChannelAccess(user.id, "EMPLOYEE", admin.id);
      outcome = "created";
    } else if (existing.status === "ACTIVE") {
      user = existing;
      outcome = "already_active";
    } else {
      await userRepository.updateProfile(existing.id, { fullName });
      const request = existing.status === "PENDING" ? await accessRequestRepository.findByUserId(existing.id) : null;
      if (request && request.status === "PENDING") {
        await userService.approveAccessRequest(admin, request.id, { notify: false });
        outcome = "approved";
      } else {
        await userRepository.updateStatus(existing.id, "ACTIVE");
        await userRepository.grantChannelAccess(existing.id, "EMPLOYEE", admin.id);
        outcome = existing.status === "PENDING" ? "approved" : "reactivated";
      }
      user = (await userRepository.findById(existing.id))!;
    }
    if (email && user.email !== email) user = await userRepository.setEmail(user.id, email);

    await auditService.record({
      actorId: admin.id,
      action: "vpn.employee_added",
      objectType: "User",
      objectId: user.id,
      result: "success",
      metadata: { outcome, previousStatus: existing?.status ?? null, deviceLimit },
    });

    // Уже активный с VPN — профиль не трогаем (лимит меняется отдельно).
    await this.createVpn(admin, user.id, deviceLimit);
    return { userId: user.id, outcome };
  }

  /** «Создать VPN»: снимает запрет и выдаёт профиль (если уже есть — ничего не меняет). */
  async createVpn(admin: AuthenticatedUser, userId: string, deviceLimit: number = VPN_PROFILE_HWID_LIMIT): Promise<void> {
    const user = await this.requireActiveEmployee(userId);
    if (user.vpnDisabledAt) await userRepository.setVpnDisabled(user.id, null);
    const access = await vpnService.getOrCreateProfile({ id: user.id, fullName: user.fullName, telegramId: user.telegramId! }, deviceLimit);
    if (access.alreadyExisted) return;
    await auditService.record({
      actorId: admin.id,
      action: "vpn.profile_created",
      objectType: "User",
      objectId: user.id,
      result: "success",
      metadata: { deviceLimit, wasDisabled: !!user.vpnDisabledAt },
    });
  }

  /** Полный перевыпуск: старые клиенты удаляются (только свои), новый профиль с тем же
   * лимитом. Сбой удаления — новый не выдаётся (revokeProfileOrThrow бросает). */
  async reissue(admin: AuthenticatedUser, userId: string): Promise<void> {
    const user = await this.requireActiveEmployee(userId);
    const profile = await vpnProfileRepository.findActiveByUserId(user.id);
    if (!profile) throw new NotFoundError("VPN ещё не выдан");
    try {
      await vpnService.revokeProfileOrThrow(user.id);
    } catch (error) {
      await this.auditFailure(admin, "vpn.reissued", user.id, error);
      throw error;
    }
    await vpnService.getOrCreateProfile({ id: user.id, fullName: user.fullName, telegramId: user.telegramId! }, profile.deviceLimit);
    await auditService.record({
      actorId: admin.id,
      action: "vpn.reissued",
      objectType: "User",
      objectId: user.id,
      result: "success",
      metadata: { deviceLimit: profile.deviceLimit },
    });
  }

  /** «Отключить VPN»: отзыв + запрет; доступ к боту остаётся. */
  async disable(admin: AuthenticatedUser, userId: string): Promise<void> {
    const user = await this.requireActiveEmployee(userId);
    try {
      await vpnService.revokeProfileOrThrow(user.id);
    } catch (error) {
      await this.auditFailure(admin, "vpn.disabled", user.id, error);
      throw error;
    }
    await userRepository.setVpnDisabled(user.id, admin.id);
    await auditService.record({ actorId: admin.id, action: "vpn.disabled", objectType: "User", objectId: user.id, result: "success" });
  }

  async setDeviceLimit(admin: AuthenticatedUser, userId: string, deviceLimit: number): Promise<void> {
    const user = await this.requireActiveEmployee(userId);
    const profile = await this.requireOwnProfile(user.id);
    const previous = profile.deviceLimit;
    await vpnPanelService.setDeviceLimit(profile.panelEmail, deviceLimit);
    const updated = await vpnProfileRepository.setDeviceLimit(profile.id, deviceLimit);
    await vpnService.syncAwgAuxClients(updated, Number(user.telegramId));
    await auditService.record({
      actorId: admin.id,
      action: "vpn.limit_changed",
      objectType: "User",
      objectId: user.id,
      result: "success",
      metadata: { from: previous, to: deviceLimit },
    });
  }

  async deleteDevice(admin: AuthenticatedUser, userId: string, deviceId: number): Promise<void> {
    const user = await this.requireActiveEmployee(userId);
    const profile = await this.requireOwnProfile(user.id);
    const devices = await vpnPanelService.listDevices(profile.panelEmail);
    const device = devices.find((d) => d.id === deviceId);
    if (!device) throw new NotFoundError("Устройство не найдено в подписке сотрудника");
    await vpnPanelService.deleteDevice(profile.panelEmail, deviceId);
    const view = toDeviceView(device);
    await auditService.record({
      actorId: admin.id,
      action: "vpn.device_deleted",
      objectType: "User",
      objectId: user.id,
      result: "success",
      metadata: { app: view.app, os: view.os, model: view.model },
    });
  }

  /** Письмо с доступом. Адрес сохраняется в карточку, если свободен (даже если письмо
   * потом не ушло); занят другим — 409 с ФИО владельца, ничего не отправляется. */
  async sendEmail(admin: AuthenticatedUser, userId: string, emailInput?: string | null): Promise<{ email: string }> {
    const user = await this.requireActiveEmployee(userId);
    const email = (emailInput?.trim().toLowerCase() || user.email || "").trim();
    if (!email) throw new ValidationError("Укажите email сотрудника");
    const profile = await this.requireOwnProfile(user.id);

    if (email !== user.email) {
      await this.assertEmailFree(email, user.id);
      await userRepository.setEmail(user.id, email);
    }

    const sent = await emailSendService.sendVpnAccess(email, {
      fullName: user.fullName,
      subscriptionUrl: vpnService.getSubscriptionUrl(profile.subId),
      deviceLimit: profile.deviceLimit,
    });
    await auditService.record({
      actorId: admin.id,
      action: "vpn.email_sent",
      objectType: "User",
      objectId: user.id,
      result: sent ? "success" : "failure",
      metadata: { email },
    });
    if (!sent) throw new HttpError(502, "Письмо не отправлено: почта не настроена или сервер почты вернул ошибку. Адрес сохранён.");
    return { email };
  }

  private async assertEmailFree(email: string, ownerId: string | null): Promise<void> {
    const owner = await userRepository.findByEmail(email);
    if (owner && owner.id !== ownerId) throw new ConflictError(`Этот email принадлежит пользователю ${owner.fullName}`);
  }

  private async requireActiveEmployee(userId: string): Promise<User & { telegramId: bigint }> {
    const user = await userRepository.findById(userId);
    if (!user || user.deletedAt) throw new NotFoundError("Сотрудник не найден");
    if (user.status !== "ACTIVE" || user.telegramId === null) {
      throw new ConflictError("VPN доступен только активным сотрудникам с Telegram");
    }
    return user as User & { telegramId: bigint };
  }

  /** Профиль, чей основной клиент на панели — его (subId совпадает); иначе действие
   * по email задело бы чужого клиента. */
  private async requireOwnProfile(userId: string): Promise<VpnProfile> {
    const profile = await vpnProfileRepository.findActiveByUserId(userId);
    if (!profile) throw new NotFoundError("VPN ещё не выдан");
    const onPanel = await vpnPanelService.getByEmail(profile.panelEmail);
    if (!onPanel || onPanel.subId !== profile.subId) throw new ConflictError("Ссылка устарела — перевыпустите её");
    return profile;
  }

  private async auditFailure(admin: AuthenticatedUser, action: string, userId: string, error: unknown): Promise<void> {
    await auditService.record({
      actorId: admin.id,
      action,
      objectType: "User",
      objectId: userId,
      result: "failure",
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export const adminVpnService = new AdminVpnService();
