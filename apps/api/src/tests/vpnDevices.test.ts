import { beforeEach, describe, expect, it, vi } from "vitest";
import { selectStaleDevices } from "@/utils/vpnStaleDevices.js";

const panel = vi.hoisted(() => ({ getByEmail: vi.fn(), listDevices: vi.fn(), deleteDevice: vi.fn() }));
const profiles = vi.hoisted(() => ({ findActiveByUserId: vi.fn(), findAllActive: vi.fn() }));
const users = vi.hoisted(() => ({ findByTelegramId: vi.fn() }));
const logger = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

vi.mock("@/config/unifiedConfig.js", () => ({ config: { vpn: { subPublicBaseUrl: "https://x/api/v1/vpn/sub/", subBaseUrl: "https://p/", deviceStaleDays: 30 } } }));
vi.mock("@/lib/logger.js", () => ({ logger }));
vi.mock("@/services/vpnPanelService.js", () => ({ vpnPanelService: panel, MERGE_FETCHER_UA: "HotLineMergeFetcher" }));
vi.mock("@/repositories/VpnProfileRepository.js", () => ({ vpnProfileRepository: profiles }));
vi.mock("@/repositories/VpnAwgSlotRepository.js", () => ({ vpnAwgSlotRepository: {} }));
vi.mock("@/repositories/UserRepository.js", () => ({ userRepository: users }));

import { vpnService } from "@/services/vpnService.js";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 1, 12);
const PROFILE = { id: "p1", userId: "u1", subId: "own-sub", panelEmail: "i.ivanov" };
const HAPP = { id: 70, firstSeen: NOW - 40 * DAY, lastSeen: NOW - 31 * DAY, userAgent: "Happ/4.12.0/ios/1", deviceOs: "iOS", osVersion: "18", deviceModel: "iPhone" };
const INCY = { id: 71, firstSeen: NOW - DAY, lastSeen: NOW - DAY, userAgent: "INCY/2.6.2/ios CFNetwork" };

describe("selectStaleDevices", () => {
  it("31 день — устаревшее, 1 день — нет", () => {
    expect(selectStaleDevices([HAPP, INCY], 30, NOW).map((d) => d.id)).toEqual([70]);
  });
  it("ровно на границе — ещё не устаревшее", () => {
    expect(selectStaleDevices([{ lastSeen: NOW - 30 * DAY }], 30, NOW)).toEqual([]);
  });
});

describe("vpnService: мои устройства", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    users.findByTelegramId.mockResolvedValue({ id: "u1", status: "ACTIVE" });
    profiles.findActiveByUserId.mockResolvedValue(PROFILE);
    panel.getByEmail.mockResolvedValue({ email: "i.ivanov", subId: "own-sub", inboundIds: [], limitHwid: 2 });
    panel.listDevices.mockResolvedValue([HAPP, INCY]);
  });

  it("лимит — фактический с панели: поднятый до 5 и «без ограничения»", async () => {
    panel.getByEmail.mockResolvedValue({ email: "i.ivanov", subId: "own-sub", inboundIds: [], limitHwid: 5 });
    expect((await vpnService.listOwnDevices(1n)).limit).toBe(5);
    panel.getByEmail.mockResolvedValue({ email: "i.ivanov", subId: "own-sub", inboundIds: [], limitHwid: 0 });
    expect((await vpnService.listOwnDevices(1n)).limit).toBeNull();
  });

  it("список своей подписки — приложение, ОС, модель, лимит", async () => {
    const result = await vpnService.listOwnDevices(1n);
    expect(result.limit).toBe(2);
    expect(result.devices[0]).toEqual({ id: 70, app: "Happ", os: "iOS 18", model: "iPhone", lastSeen: new Date(HAPP.lastSeen).toISOString() });
    expect(result.devices[1]).toMatchObject({ id: 71, app: "INCY", os: null, model: null });
  });

  it("служебный запрос AmneziaWG не подменяет приложение в списке", async () => {
    panel.listDevices.mockResolvedValue([{ ...INCY, userAgent: "HotLineMergeFetcher (INCY/2.6.2/ios CFNetwork)" }]);
    expect((await vpnService.listOwnDevices(1n)).devices[0]!.app).toBe("INCY");
  });

  it("логин на панели занят чужим клиентом — устройства не показываются", async () => {
    panel.getByEmail.mockResolvedValue({ email: "i.ivanov", subId: "someone-else", inboundIds: [] });
    await expect(vpnService.listOwnDevices(1n)).rejects.toThrow(/устарела/);
    expect(panel.listDevices).not.toHaveBeenCalled();
  });

  it("VPN не выдан", async () => {
    profiles.findActiveByUserId.mockResolvedValue(null);
    await expect(vpnService.listOwnDevices(1n)).rejects.toThrow(/не выдан/);
  });

  it("удаляет своё устройство", async () => {
    await vpnService.deleteOwnDevice(1n, 70);
    expect(panel.deleteDevice).toHaveBeenCalledWith("i.ivanov", 70);
  });

  it("id не из своей подписки — ничего не удаляется", async () => {
    await expect(vpnService.deleteOwnDevice(1n, 999)).rejects.toThrow(/не найдено/);
    expect(panel.deleteDevice).not.toHaveBeenCalled();
  });
});

describe("vpnService.cleanupStaleDevices", () => {
  beforeEach(() => vi.resetAllMocks());

  it("удаляет только устаревшие устройства своих профилей, ошибка одного не останавливает остальных", async () => {
    profiles.findAllActive.mockResolvedValue([
      { ...PROFILE, panelEmail: "broken" },
      { ...PROFILE, panelEmail: "stale-owner", subId: "old-uuid" },
      PROFILE,
    ]);
    panel.getByEmail.mockImplementation(async (email: string) => {
      if (email === "broken") throw new Error("panel down");
      if (email === "stale-owner") return { email, subId: "someone-else", inboundIds: [] };
      return { email, subId: "own-sub", inboundIds: [] };
    });
    panel.listDevices.mockResolvedValue([HAPP, INCY]);

    const result = await vpnService.cleanupStaleDevices(NOW);

    expect(panel.deleteDevice.mock.calls).toEqual([["i.ivanov", 70]]);
    expect(result).toEqual({ checked: 1, removed: 1, failed: 1 });
  });
});
