import { beforeEach, describe, expect, it, vi } from "vitest";

const panel = vi.hoisted(() => ({ deleteClient: vi.fn(), getByEmail: vi.fn(), createClient: vi.fn(), bulkCreate: vi.fn() }));
const profiles = vi.hoisted(() => ({ findActiveByUserId: vi.fn(), revoke: vi.fn(), create: vi.fn() }));
const slots = vi.hoisted(() => ({ deleteAllForProfile: vi.fn(), deleteAbove: vi.fn() }));
const aux = vi.hoisted(() => ({ listByProfile: vi.fn(), create: vi.fn(), delete: vi.fn(), deleteAllForProfile: vi.fn(), findBySlot: vi.fn() }));
const logger = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

vi.mock("@/config/unifiedConfig.js", () => ({ config: { vpn: { subPublicBaseUrl: "https://x/api/v1/vpn/sub/", subBaseUrl: "https://p/" } } }));
vi.mock("@/lib/logger.js", () => ({ logger }));
vi.mock("@/services/vpnPanelService.js", () => {
  let n = 0;
  return { vpnPanelService: panel, MERGE_FETCHER_UA: "HotLineMergeFetcher", generateSubId: () => `gen-${++n}` };
});
vi.mock("@/repositories/VpnProfileRepository.js", () => ({ vpnProfileRepository: profiles }));
vi.mock("@/repositories/VpnAwgSlotRepository.js", () => ({ vpnAwgSlotRepository: slots }));
vi.mock("@/repositories/VpnAwgAuxClientRepository.js", () => ({ vpnAwgAuxClientRepository: aux }));
vi.mock("@/repositories/UserRepository.js", () => ({ userRepository: {} }));

import { vpnService } from "@/services/vpnService.js";

const PROFILE = { id: "p1", subId: "own-sub", panelEmail: "i.ivanov", deviceLimit: 2 };
const auxRow = (slot: number) => ({ id: `a${slot}`, profileId: "p1", slot, panelEmail: `i.ivanov-AWG${slot}`, subId: `aux-${slot}` });
/** Панель: основной клиент принадлежит профилю (тот же subId). */
const ownClient = { email: "i.ivanov", subId: "own-sub", inboundIds: [] };

describe("vpnService.revokeProfile (увольнение, AmneziaWG)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    profiles.findActiveByUserId.mockResolvedValue(PROFILE);
    panel.getByEmail.mockResolvedValue(ownClient);
    aux.listByProfile.mockResolvedValue([auxRow(2)]);
  });

  it("удаляет вспомогательного и основного клиента, слоты, отзывает профиль", async () => {
    panel.deleteClient.mockResolvedValue(undefined);
    await vpnService.revokeProfile("u1");
    expect(panel.deleteClient.mock.calls.map((c) => c[0])).toEqual(["i.ivanov-AWG2", "i.ivanov"]);
    expect(slots.deleteAllForProfile).toHaveBeenCalledWith("p1");
    expect(aux.deleteAllForProfile).toHaveBeenCalledWith("p1");
    expect(profiles.revoke).toHaveBeenCalledWith("p1");
  });

  it("лимит 5 — удаляются все -AWG2…-AWG5 и основной", async () => {
    aux.listByProfile.mockResolvedValue([2, 3, 4, 5].map(auxRow));
    panel.deleteClient.mockResolvedValue(undefined);
    await vpnService.revokeProfile("u1");
    expect(panel.deleteClient.mock.calls.map((c) => c[0])).toEqual([
      "i.ivanov-AWG2",
      "i.ivanov-AWG3",
      "i.ivanov-AWG4",
      "i.ivanov-AWG5",
      "i.ivanov",
    ]);
    expect(profiles.revoke).toHaveBeenCalledWith("p1");
  });

  it("сбой удаления вспомогательного клиента — профиль остаётся активным, ошибка в логе", async () => {
    aux.listByProfile.mockResolvedValue([2, 3].map(auxRow));
    panel.deleteClient.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("panel down"));
    await vpnService.revokeProfile("u1");
    expect(profiles.revoke).not.toHaveBeenCalled();
    expect(slots.deleteAllForProfile).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ panelEmail: "i.ivanov-AWG3" }), expect.any(String));
  });

  it("revokeProfileOrThrow — сбой удаления уходит наверх (перевыпуск/отключение Администратором)", async () => {
    panel.deleteClient.mockRejectedValueOnce(new Error("panel down"));
    await expect(vpnService.revokeProfileOrThrow("u1")).rejects.toThrow(/i\.ivanov-AWG2/);
    expect(profiles.revoke).not.toHaveBeenCalled();
  });

  it("клиента на панели уже нет — считается удалённым", async () => {
    panel.deleteClient.mockRejectedValueOnce(new Error("not found")).mockResolvedValueOnce(undefined);
    panel.getByEmail.mockResolvedValueOnce(ownClient).mockResolvedValueOnce(null);
    await vpnService.revokeProfile("u1");
    expect(profiles.revoke).toHaveBeenCalledWith("p1");
  });

  it("профиль без вспомогательных клиентов — удаляется только основной", async () => {
    aux.listByProfile.mockResolvedValue([]);
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

  it("нет активного профиля — false, ничего не делается", async () => {
    profiles.findActiveByUserId.mockResolvedValue(null);
    await expect(vpnService.revokeProfileOrThrow("u1")).resolves.toBe(false);
    expect(panel.getByEmail).not.toHaveBeenCalled();
  });
});

describe("vpnService.syncAwgAuxClients (ключи по лимиту устройств)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    panel.getByEmail.mockResolvedValue(null);
    panel.bulkCreate.mockResolvedValue({ created: 0, skipped: [] });
    panel.deleteClient.mockResolvedValue(undefined);
  });

  it("2→4: один bulkCreate на -AWG3 и -AWG4, записи в БД", async () => {
    aux.listByProfile.mockResolvedValue([auxRow(2)]);
    await vpnService.syncAwgAuxClients({ ...PROFILE, deviceLimit: 4 }, 42);
    expect(panel.bulkCreate).toHaveBeenCalledTimes(1);
    const items = panel.bulkCreate.mock.calls[0]![0] as { email: string; limitHwid: number }[];
    expect(items.map((i) => i.email)).toEqual(["i.ivanov-AWG3", "i.ivanov-AWG4"]);
    expect(items.every((i) => i.limitHwid === 0)).toBe(true);
    expect(aux.create.mock.calls.map((c) => c[0].slot)).toEqual([3, 4]);
    expect(panel.deleteClient).not.toHaveBeenCalled();
  });

  it("4→2: удаляются -AWG3, -AWG4 и слоты выше 2", async () => {
    aux.listByProfile.mockResolvedValue([2, 3, 4].map(auxRow));
    await vpnService.syncAwgAuxClients({ ...PROFILE, deviceLimit: 2 }, 42);
    expect(panel.deleteClient.mock.calls.map((c) => c[0])).toEqual(["i.ivanov-AWG3", "i.ivanov-AWG4"]);
    expect(aux.delete.mock.calls.map((c) => c[0])).toEqual(["a3", "a4"]);
    expect(slots.deleteAbove).toHaveBeenCalledWith("p1", 2);
    expect(panel.bulkCreate).not.toHaveBeenCalled();
  });

  it("без изменений — панель не трогается", async () => {
    aux.listByProfile.mockResolvedValue([auxRow(2)]);
    await vpnService.syncAwgAuxClients(PROFILE, 42);
    expect(panel.bulkCreate).not.toHaveBeenCalled();
    expect(panel.deleteClient).not.toHaveBeenCalled();
    expect(slots.deleteAbove).not.toHaveBeenCalled();
  });

  it("клиент уже есть на панели (прошлый сбой) — подхватывается, не создаётся второй раз", async () => {
    aux.listByProfile.mockResolvedValue([]);
    panel.getByEmail.mockResolvedValue({ email: "i.ivanov-AWG2", subId: "existing-sub", inboundIds: [] });
    await vpnService.syncAwgAuxClients(PROFILE, 42);
    expect(panel.bulkCreate).not.toHaveBeenCalled();
    expect(aux.create).toHaveBeenCalledWith(expect.objectContaining({ slot: 2, subId: "existing-sub" }));
  });

  it("панель пропустила клиента — ошибка, запись не создаётся", async () => {
    aux.listByProfile.mockResolvedValue([auxRow(2)]);
    panel.bulkCreate.mockResolvedValue({ created: 0, skipped: [{ email: "i.ivanov-AWG3", reason: "exists" }] });
    await expect(vpnService.syncAwgAuxClients({ ...PROFILE, deviceLimit: 3 }, 42)).rejects.toThrow(/AWG3/);
    expect(aux.create).not.toHaveBeenCalled();
  });
});

describe("vpnService.getOrCreateProfile (устаревший профиль после миграции панели)", () => {
  const USER = { id: "u1", fullName: "Комлик Виктория Юрьевна", telegramId: 5220537327n };

  beforeEach(() => {
    vi.resetAllMocks();
    profiles.create.mockImplementation(async (data: object) => ({ id: "p2", ...data }));
    panel.createClient.mockResolvedValue({ subId: "new-sub" });
    panel.bulkCreate.mockResolvedValue({ created: 1, skipped: [] });
    aux.listByProfile.mockResolvedValue([]);
  });

  it("subId на панели совпадает — отдаётся та же ссылка", async () => {
    profiles.findActiveByUserId.mockResolvedValue(PROFILE);
    panel.getByEmail.mockResolvedValue(ownClient);
    const result = await vpnService.getOrCreateProfile(USER);
    expect(result).toEqual({ subscriptionUrl: "https://x/api/v1/vpn/sub/own-sub", alreadyExisted: true });
    expect(profiles.revoke).not.toHaveBeenCalled();
  });

  it("email на панели занят чужим клиентом — старый профиль отзывается локально, выдаётся новая ссылка с тем же лимитом", async () => {
    profiles.findActiveByUserId.mockResolvedValue({ ...PROFILE, panelEmail: "k.yurevna", subId: "d533baae-uuid", deviceLimit: 4 });
    // k.yurevna — чужой клиент; v.komlik свободен; -AWG<N> ещё нет.
    panel.getByEmail.mockImplementation(async (email: string) =>
      email === "k.yurevna" ? { email, subId: "oy18u5uq09bgsvkt", inboundIds: [] } : null,
    );
    const result = await vpnService.getOrCreateProfile(USER);
    expect(profiles.revoke).toHaveBeenCalledWith("p1");
    expect(panel.deleteClient).not.toHaveBeenCalled();
    expect(panel.createClient).toHaveBeenCalledWith(expect.objectContaining({ email: "v.komlik", limitHwid: 4 }));
    expect(profiles.create).toHaveBeenCalledWith(expect.objectContaining({ deviceLimit: 4 }));
    expect(result).toEqual({ subscriptionUrl: "https://x/api/v1/vpn/sub/new-sub", alreadyExisted: false });
  });

  it("новый профиль с лимитом 3 — создаются -AWG2 и -AWG3", async () => {
    profiles.findActiveByUserId.mockResolvedValue(null);
    panel.getByEmail.mockResolvedValue(null);
    await vpnService.getOrCreateProfile(USER, 3);
    expect(panel.createClient).toHaveBeenCalledWith(expect.objectContaining({ limitHwid: 3 }));
    const items = panel.bulkCreate.mock.calls[0]![0] as { email: string }[];
    expect(items.map((i) => i.email)).toEqual(["v.komlik-AWG2", "v.komlik-AWG3"]);
  });

  it("сбой создания вспомогательных клиентов не ломает выдачу VPN", async () => {
    profiles.findActiveByUserId.mockResolvedValue(null);
    panel.getByEmail.mockResolvedValue(null);
    panel.bulkCreate.mockRejectedValue(new Error("panel down"));
    const result = await vpnService.getOrCreateProfile(USER);
    expect(result.alreadyExisted).toBe(false);
    expect(logger.error).toHaveBeenCalled();
  });
});
