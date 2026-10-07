import { beforeEach, describe, expect, it, vi } from "vitest";

const users = vi.hoisted(() => ({
  findByTelegramId: vi.fn(),
  findById: vi.fn(),
  findByEmail: vi.fn(),
  createTelegramEmployee: vi.fn(),
  grantChannelAccess: vi.fn(),
  updateProfile: vi.fn(),
  updateStatus: vi.fn(),
  setEmail: vi.fn(),
  setVpnDisabled: vi.fn(),
}));
const requests = vi.hoisted(() => ({ findByUserId: vi.fn() }));
const profiles = vi.hoisted(() => ({ findActiveByUserId: vi.fn(), setDeviceLimit: vi.fn() }));
const vpn = vi.hoisted(() => ({ getOrCreateProfile: vi.fn(), revokeProfileOrThrow: vi.fn(), syncAwgAuxClients: vi.fn(), getSubscriptionUrl: vi.fn() }));
const userSvc = vi.hoisted(() => ({ approveAccessRequest: vi.fn() }));
const panel = vi.hoisted(() => ({ getByEmail: vi.fn(), setDeviceLimit: vi.fn(), listDevices: vi.fn(), deleteDevice: vi.fn() }));
const audit = vi.hoisted(() => ({ record: vi.fn() }));
const mail = vi.hoisted(() => ({ sendVpnAccess: vi.fn() }));

vi.mock("@/config/unifiedConfig.js", () => ({ config: { email: { webAppUrl: "https://hot" }, vpn: {} } }));
vi.mock("@/lib/logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/repositories/UserRepository.js", () => ({ userRepository: users }));
vi.mock("@/repositories/AccessRequestRepository.js", () => ({ accessRequestRepository: requests }));
vi.mock("@/repositories/VpnProfileRepository.js", () => ({ vpnProfileRepository: profiles }));
vi.mock("@/repositories/VpnUsageSnapshotRepository.js", () => ({ vpnUsageSnapshotRepository: {} }));
vi.mock("@/services/vpnService.js", () => ({ vpnService: vpn, toDeviceView: (d: object) => d }));
vi.mock("@/services/userService.js", () => ({ userService: userSvc }));
vi.mock("@/services/vpnPanelService.js", () => ({ vpnPanelService: panel }));
vi.mock("@/services/auditService.js", () => ({ auditService: audit }));
vi.mock("@/services/emailSendService.js", () => ({ emailSendService: mail }));

import { adminVpnService } from "@/services/adminVpnService.js";

const ADMIN = { id: "admin" } as never;
const TG = 123456789n;
const INPUT = { telegramId: TG, fullName: "Иванов Иван Иванович" };
const user = (over: object = {}) => ({ id: "u1", fullName: "Иванов Иван Иванович", telegramId: TG, status: "ACTIVE", email: null, vpnDisabledAt: null, deletedAt: null, ...over });

describe("adminVpnService.addEmployee (таблица состояний Telegram ID)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vpn.getOrCreateProfile.mockResolvedValue({ subscriptionUrl: "x", alreadyExisted: false });
    users.findById.mockResolvedValue(user());
    users.createTelegramEmployee.mockResolvedValue(user());
  });

  it("нет в базе — новый активный сотрудник, канал EMPLOYEE, VPN с лимитом", async () => {
    users.findByTelegramId.mockResolvedValue(null);
    const r = await adminVpnService.addEmployee(ADMIN, { ...INPUT, deviceLimit: 3 });
    expect(r.outcome).toBe("created");
    expect(users.createTelegramEmployee).toHaveBeenCalledWith(expect.objectContaining({ telegramId: TG, fullName: "Иванов Иван Иванович" }));
    expect(users.grantChannelAccess).toHaveBeenCalledWith("u1", "EMPLOYEE", "admin");
    expect(vpn.getOrCreateProfile).toHaveBeenCalledWith(expect.objectContaining({ id: "u1" }), 3);
  });

  it("висит заявка — одобряется без уведомления в бот, ФИО из формы", async () => {
    users.findByTelegramId.mockResolvedValue(user({ status: "PENDING", fullName: "/vpn" }));
    requests.findByUserId.mockResolvedValue({ id: "r1", status: "PENDING" });
    const r = await adminVpnService.addEmployee(ADMIN, INPUT);
    expect(r.outcome).toBe("approved");
    expect(users.updateProfile).toHaveBeenCalledWith("u1", { fullName: "Иванов Иван Иванович" });
    expect(userSvc.approveAccessRequest).toHaveBeenCalledWith(ADMIN, "r1", { notify: false });
    expect(vpn.getOrCreateProfile).toHaveBeenCalled();
  });

  it("уже активен — второй не создаётся, VPN выдаётся (если есть — тот же)", async () => {
    users.findByTelegramId.mockResolvedValue(user());
    const r = await adminVpnService.addEmployee(ADMIN, INPUT);
    expect(r.outcome).toBe("already_active");
    expect(users.createTelegramEmployee).not.toHaveBeenCalled();
    expect(users.updateStatus).not.toHaveBeenCalled();
    expect(vpn.getOrCreateProfile).toHaveBeenCalled();
  });

  it("мягко отклонён — активируется, канал EMPLOYEE", async () => {
    users.findByTelegramId.mockResolvedValue(user({ status: "REJECTED" }));
    const r = await adminVpnService.addEmployee(ADMIN, INPUT);
    expect(r.outcome).toBe("reactivated");
    expect(users.updateStatus).toHaveBeenCalledWith("u1", "ACTIVE");
    expect(users.grantChannelAccess).toHaveBeenCalledWith("u1", "EMPLOYEE", "admin");
  });

  it.each(["BLOCKED", "ARCHIVED"])("%s — отказ, ничего не меняется", async (status) => {
    users.findByTelegramId.mockResolvedValue(user({ status }));
    await expect(adminVpnService.addEmployee(ADMIN, INPUT)).rejects.toThrow(/разблокируйте/);
    expect(users.updateStatus).not.toHaveBeenCalled();
    expect(vpn.getOrCreateProfile).not.toHaveBeenCalled();
  });

  it("неверное ФИО — отказ до любых изменений", async () => {
    await expect(adminVpnService.addEmployee(ADMIN, { ...INPUT, fullName: "/vpn" })).rejects.toThrow(/ФИО/);
    expect(users.findByTelegramId).not.toHaveBeenCalled();
  });

  it("email занят другим — 409 с ФИО владельца, сотрудник не создаётся", async () => {
    users.findByTelegramId.mockResolvedValue(null);
    users.findByEmail.mockResolvedValue({ id: "other", fullName: "Петров Пётр" });
    await expect(adminVpnService.addEmployee(ADMIN, { ...INPUT, email: "a@b.ru" })).rejects.toThrow("Этот email принадлежит пользователю Петров Пётр");
    expect(users.createTelegramEmployee).not.toHaveBeenCalled();
  });
});

describe("adminVpnService.reissue / disable", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    users.findById.mockResolvedValue(user());
    profiles.findActiveByUserId.mockResolvedValue({ id: "p1", deviceLimit: 4 });
    vpn.getOrCreateProfile.mockResolvedValue({ subscriptionUrl: "new", alreadyExisted: false });
  });

  it("перевыпуск: отзыв, затем новый профиль с тем же лимитом, аудит без ссылки", async () => {
    await adminVpnService.reissue(ADMIN, "u1");
    expect(vpn.revokeProfileOrThrow).toHaveBeenCalledWith("u1");
    expect(vpn.getOrCreateProfile).toHaveBeenCalledWith(expect.objectContaining({ id: "u1" }), 4);
    const entry = audit.record.mock.calls[0]![0];
    expect(entry).toMatchObject({ action: "vpn.reissued", result: "success" });
    expect(JSON.stringify(entry)).not.toContain("new");
  });

  it("сбой удаления старых клиентов — новый не выдаётся, ошибка наверх, аудит failure", async () => {
    vpn.revokeProfileOrThrow.mockRejectedValue(new Error("panel down"));
    await expect(adminVpnService.reissue(ADMIN, "u1")).rejects.toThrow("panel down");
    expect(vpn.getOrCreateProfile).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "vpn.reissued", result: "failure" }));
  });

  it("отключение: отзыв и запрет", async () => {
    await adminVpnService.disable(ADMIN, "u1");
    expect(vpn.revokeProfileOrThrow).toHaveBeenCalledWith("u1");
    expect(users.setVpnDisabled).toHaveBeenCalledWith("u1", "admin");
  });

  it("сбой отзыва при отключении — запрет не ставится", async () => {
    vpn.revokeProfileOrThrow.mockRejectedValue(new Error("panel down"));
    await expect(adminVpnService.disable(ADMIN, "u1")).rejects.toThrow();
    expect(users.setVpnDisabled).not.toHaveBeenCalled();
  });

  it("«Создать VPN» снимает запрет", async () => {
    users.findById.mockResolvedValue(user({ vpnDisabledAt: new Date() }));
    await adminVpnService.createVpn(ADMIN, "u1", 2);
    expect(users.setVpnDisabled).toHaveBeenCalledWith("u1", null);
    expect(vpn.getOrCreateProfile).toHaveBeenCalled();
  });
});

describe("adminVpnService.sendEmail", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    users.findById.mockResolvedValue(user());
    profiles.findActiveByUserId.mockResolvedValue({ id: "p1", panelEmail: "i.ivanov", subId: "s", deviceLimit: 2 });
    panel.getByEmail.mockResolvedValue({ subId: "s" });
    vpn.getSubscriptionUrl.mockReturnValue("https://hot/sub/s");
  });

  it("нет email у сотрудника и не введён — просит указать", async () => {
    await expect(adminVpnService.sendEmail(ADMIN, "u1")).rejects.toThrow(/Укажите email/);
  });

  it("введённый адрес сохраняется и письмо уходит", async () => {
    users.findByEmail.mockResolvedValue(null);
    mail.sendVpnAccess.mockResolvedValue(true);
    await expect(adminVpnService.sendEmail(ADMIN, "u1", "I.Ivanov@Lemark.ru")).resolves.toEqual({ email: "i.ivanov@lemark.ru" });
    expect(users.setEmail).toHaveBeenCalledWith("u1", "i.ivanov@lemark.ru");
  });

  it("сбой отправки — адрес сохранён, ошибка", async () => {
    users.findByEmail.mockResolvedValue(null);
    mail.sendVpnAccess.mockResolvedValue(false);
    await expect(adminVpnService.sendEmail(ADMIN, "u1", "a@b.ru")).rejects.toThrow(/не отправлено/);
    expect(users.setEmail).toHaveBeenCalled();
  });

  it("адрес занят — ничего не отправляется и не сохраняется", async () => {
    users.findByEmail.mockResolvedValue({ id: "other", fullName: "Петров Пётр" });
    await expect(adminVpnService.sendEmail(ADMIN, "u1", "a@b.ru")).rejects.toThrow(/Петров Пётр/);
    expect(users.setEmail).not.toHaveBeenCalled();
    expect(mail.sendVpnAccess).not.toHaveBeenCalled();
  });
});
