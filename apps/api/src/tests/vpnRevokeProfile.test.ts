import { beforeEach, describe, expect, it, vi } from "vitest";

const panel = vi.hoisted(() => ({ deleteClient: vi.fn(), getByEmail: vi.fn(), createClient: vi.fn() }));
const profiles = vi.hoisted(() => ({ findActiveByUserId: vi.fn(), revoke: vi.fn(), create: vi.fn(), setAwgAux: vi.fn() }));
const slots = vi.hoisted(() => ({ deleteAllForProfile: vi.fn() }));
const logger = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

vi.mock("@/config/unifiedConfig.js", () => ({ config: { vpn: { subPublicBaseUrl: "https://x/api/v1/vpn/sub/", subBaseUrl: "https://p/" } } }));
vi.mock("@/lib/logger.js", () => ({ logger }));
vi.mock("@/services/vpnPanelService.js", () => ({ vpnPanelService: panel, MERGE_FETCHER_UA: "HotLineMergeFetcher" }));
vi.mock("@/repositories/VpnProfileRepository.js", () => ({ vpnProfileRepository: profiles }));
vi.mock("@/repositories/VpnAwgSlotRepository.js", () => ({ vpnAwgSlotRepository: slots }));
vi.mock("@/repositories/UserRepository.js", () => ({ userRepository: {} }));

import { vpnService } from "@/services/vpnService.js";

const PROFILE = { id: "p1", subId: "own-sub", panelEmail: "i.ivanov", awgAuxPanelEmail: "i.ivanov-AWG2", awgAuxSubId: "hidden" };
/** Панель: основной клиент принадлежит профилю (тот же subId). */
const ownClient = { email: "i.ivanov", subId: "own-sub", inboundIds: [] };

describe("vpnService.revokeProfile (увольнение, AmneziaWG)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    profiles.findActiveByUserId.mockResolvedValue(PROFILE);
    panel.getByEmail.mockResolvedValue(ownClient);
  });

  it("удаляет вспомогательного и основного клиента, слоты, отзывает профиль", async () => {
    panel.deleteClient.mockResolvedValue(undefined);
    await vpnService.revokeProfile("u1");
    expect(panel.deleteClient.mock.calls.map((c) => c[0])).toEqual(["i.ivanov-AWG2", "i.ivanov"]);
    expect(slots.deleteAllForProfile).toHaveBeenCalledWith("p1");
    expect(profiles.revoke).toHaveBeenCalledWith("p1");
  });

  it("сбой удаления вспомогательного клиента — профиль остаётся активным, ошибка в логе", async () => {
    panel.deleteClient.mockRejectedValueOnce(new Error("panel down"));
    await vpnService.revokeProfile("u1");
    expect(profiles.revoke).not.toHaveBeenCalled();
    expect(slots.deleteAllForProfile).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ panelEmail: "i.ivanov-AWG2" }), expect.any(String));
  });

  it("клиента на панели уже нет — считается удалённым", async () => {
    panel.deleteClient.mockRejectedValueOnce(new Error("not found")).mockResolvedValueOnce(undefined);
    panel.getByEmail.mockResolvedValueOnce(ownClient).mockResolvedValueOnce(null);
    await vpnService.revokeProfile("u1");
    expect(profiles.revoke).toHaveBeenCalledWith("p1");
  });

  it("профиль без вспомогательного клиента (до бэкфилла) — как раньше", async () => {
    profiles.findActiveByUserId.mockResolvedValue({ ...PROFILE, awgAuxPanelEmail: null, awgAuxSubId: null });
    panel.deleteClient.mockResolvedValue(undefined);
    await vpnService.revokeProfile("u1");
    expect(panel.deleteClient.mock.calls.map((c) => c[0])).toEqual(["i.ivanov"]);
    expect(profiles.revoke).toHaveBeenCalled();
  });

  it("устаревший профиль (email на панели занят другим сотрудником) — на панели ничего не удаляется", async () => {
    panel.getByEmail.mockResolvedValue({ email: "i.ivanov", subId: "someone-else", inboundIds: [] });
    await vpnService.revokeProfile("u1");
    expect(panel.deleteClient).not.toHaveBeenCalled();
    expect(slots.deleteAllForProfile).toHaveBeenCalledWith("p1");
    expect(profiles.revoke).toHaveBeenCalledWith("p1");
  });
});

describe("vpnService.getOrCreateProfile (устаревший профиль после миграции панели)", () => {
  const USER = { id: "u1", fullName: "Комлик Виктория Юрьевна", telegramId: 5220537327n };

  beforeEach(() => {
    vi.resetAllMocks();
    profiles.create.mockImplementation(async (data: object) => ({ id: "p2", awgAuxSubId: null, ...data }));
    panel.createClient.mockResolvedValue({ subId: "new-sub" });
  });

  it("subId на панели совпадает — отдаётся та же ссылка", async () => {
    profiles.findActiveByUserId.mockResolvedValue(PROFILE);
    panel.getByEmail.mockResolvedValue(ownClient);
    const result = await vpnService.getOrCreateProfile(USER);
    expect(result).toEqual({ subscriptionUrl: "https://x/api/v1/vpn/sub/own-sub", alreadyExisted: true });
    expect(profiles.revoke).not.toHaveBeenCalled();
  });

  it("email на панели занят чужим клиентом — старый профиль отзывается локально, выдаётся новая ссылка", async () => {
    profiles.findActiveByUserId.mockResolvedValue({ ...PROFILE, panelEmail: "k.yurevna", subId: "d533baae-uuid" });
    // k.yurevna — чужой клиент; v.komlik свободен; -AWG2 ещё нет.
    panel.getByEmail.mockImplementation(async (email: string) =>
      email === "k.yurevna" ? { email, subId: "oy18u5uq09bgsvkt", inboundIds: [] } : null,
    );
    const result = await vpnService.getOrCreateProfile(USER);
    expect(profiles.revoke).toHaveBeenCalledWith("p1");
    expect(panel.deleteClient).not.toHaveBeenCalled();
    expect(panel.createClient).toHaveBeenCalledWith(expect.objectContaining({ email: "v.komlik" }));
    expect(result).toEqual({ subscriptionUrl: "https://x/api/v1/vpn/sub/new-sub", alreadyExisted: false });
  });
});
