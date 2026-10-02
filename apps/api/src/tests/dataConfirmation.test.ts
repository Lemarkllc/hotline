import { beforeEach, describe, expect, it, vi } from "vitest";
import { decideDataConfirmation, DATA_CONFIRMATION_WINDOW_MS } from "@/utils/dataConfirmation.js";

const users = vi.hoisted(() => ({
  findById: vi.fn(),
  findByTelegramId: vi.fn(),
  blockUser: vi.fn(),
  updateProfile: vi.fn(),
  setDataConfirmationDeadline: vi.fn(),
  clearDataConfirmation: vi.fn(),
  markDataConfirmationReminded: vi.fn(),
  findWithPendingDataConfirmation: vi.fn(),
}));
const notify = vi.hoisted(() => ({
  notifyEmployeeTerminated: vi.fn(),
  notifyBlockedDataUnconfirmed: vi.fn(),
  notifyConfirmDataRequest: vi.fn(),
  notifyConfirmDataReminder: vi.fn(),
  notifyDataConfirmationOutcome: vi.fn(),
}));
const vpn = vi.hoisted(() => ({ revokeProfile: vi.fn() }));
const audit = vi.hoisted(() => ({ record: vi.fn() }));

vi.mock("@/repositories/UserRepository.js", () => ({ userRepository: users }));
vi.mock("@/repositories/AccessRequestRepository.js", () => ({ accessRequestRepository: {} }));
vi.mock("@/services/authService.js", () => ({ authService: {} }));
vi.mock("@/services/emailSendService.js", () => ({ emailSendService: {} }));
vi.mock("@/services/notificationService.js", () => ({ notificationService: notify }));
vi.mock("@/services/vpnService.js", () => ({ vpnService: vpn }));
vi.mock("@/services/auditService.js", () => ({ auditService: audit }));
vi.mock("@/lib/logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { userService } from "@/services/userService.js";

const H = 60 * 60 * 1000;
const NOW = new Date(Date.UTC(2026, 9, 2, 12));
const ADMIN = { id: "admin-1" } as never;
const pending = (hoursLeft: number, reminded = false) => ({
  id: "u1",
  fullName: "Иванов Иван Иванович",
  status: "ACTIVE",
  telegramId: 1n,
  dataConfirmationDeadline: new Date(NOW.getTime() + hoursLeft * H),
  dataConfirmationRemindedAt: reminded ? NOW : null,
  dataConfirmationRequestedById: "admin-1",
});

describe("decideDataConfirmation", () => {
  it.each([
    [6, false, "none"],
    [5, false, "remind"],
    [1, true, "none"],
    [0, false, "block"],
    [-3, true, "block"],
  ] as const)("осталось %s ч (напомнено: %s) → %s", (hours, reminded, expected) => {
    expect(decideDataConfirmation(pending(hours, reminded), NOW)).toBe(expected);
  });

  it("сотрудник уже не активен — просто снять срок", () => {
    expect(decideDataConfirmation({ ...pending(-1), status: "BLOCKED" }, NOW)).toBe("clear");
  });

  it("проверки нет — ничего", () => {
    expect(decideDataConfirmation({ status: "ACTIVE", dataConfirmationDeadline: null, dataConfirmationRemindedAt: null }, NOW)).toBe("none");
  });
});

describe("userService: подтверждение данных", () => {
  beforeEach(() => vi.resetAllMocks());

  it("запрос ставит срок 2 дня и шлёт сообщение с ФИО", async () => {
    users.findById.mockResolvedValue({ ...pending(0), dataConfirmationDeadline: null });
    const before = Date.now();
    await userService.requestDataConfirmation(ADMIN, "u1");
    const [, deadline, requestedBy] = users.setDataConfirmationDeadline.mock.calls[0]!;
    expect(requestedBy).toBe("admin-1");
    expect((deadline as Date).getTime() - before).toBeGreaterThanOrEqual(DATA_CONFIRMATION_WINDOW_MS);
    expect(notify.notifyConfirmDataRequest).toHaveBeenCalledWith("u1", "Иванов Иван Иванович", deadline);
  });

  it("«Данные верны» снимает срок и уведомляет запросившего", async () => {
    users.findByTelegramId.mockResolvedValue(pending(10));
    expect(await userService.confirmDataSelf(1n)).toEqual({ confirmed: true });
    expect(users.clearDataConfirmation).toHaveBeenCalledWith("u1");
    expect(notify.notifyDataConfirmationOutcome).toHaveBeenCalledWith("admin-1", "confirmed", "Иванов Иван Иванович");
  });

  it("«Данные верны» без активной проверки — ничего не меняется", async () => {
    users.findByTelegramId.mockResolvedValue({ ...pending(10), dataConfirmationDeadline: null });
    expect(await userService.confirmDataSelf(1n)).toEqual({ confirmed: false });
    expect(users.clearDataConfirmation).not.toHaveBeenCalled();
  });

  it("исправленное ФИО тоже подтверждает, в уведомлении новое ФИО", async () => {
    users.findByTelegramId.mockResolvedValue(pending(10));
    await userService.fixFullNameSelf(1n, "Петров Пётр Петрович");
    expect(users.clearDataConfirmation).toHaveBeenCalledWith("u1");
    expect(notify.notifyDataConfirmationOutcome).toHaveBeenCalledWith("admin-1", "confirmed", "Петров Пётр Петрович");
  });

  it("обработка сроков: напоминание один раз, блокировка с честной причиной", async () => {
    users.findWithPendingDataConfirmation.mockResolvedValue([
      { ...pending(4), id: "remind-me" },
      { ...pending(-1), id: "block-me" },
      { ...pending(30), id: "wait" },
    ]);
    users.findById.mockImplementation(async (id: string) => ({ ...pending(-1), id }));

    const result = await userService.processDataConfirmationDeadlines(NOW);

    expect(result).toEqual({ reminded: 1, blocked: 1, failed: 0 });
    expect(notify.notifyConfirmDataReminder).toHaveBeenCalledWith("remind-me", "Иванов Иван Иванович", expect.any(Date));
    expect(users.markDataConfirmationReminded).toHaveBeenCalledWith("remind-me", NOW);
    expect(users.blockUser).toHaveBeenCalledWith("block-me", "Не подтвердил данные в срок");
    expect(notify.notifyBlockedDataUnconfirmed).toHaveBeenCalledWith("block-me");
    expect(notify.notifyEmployeeTerminated).not.toHaveBeenCalled();
    expect(vpn.revokeProfile).toHaveBeenCalledWith("block-me");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actorId: null, action: "user.blocked" }));
    expect(notify.notifyDataConfirmationOutcome).toHaveBeenCalledWith("admin-1", "blocked", "Иванов Иван Иванович");
  });

  it("ручная блокировка по-прежнему шлёт employee_terminated", async () => {
    users.findById.mockResolvedValue(pending(10));
    await userService.blockUser(ADMIN, "u1", "вручную");
    expect(notify.notifyEmployeeTerminated).toHaveBeenCalledWith("u1");
    expect(notify.notifyBlockedDataUnconfirmed).not.toHaveBeenCalled();
    expect(vpn.revokeProfile).toHaveBeenCalledWith("u1");
  });
});
