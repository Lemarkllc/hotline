import { beforeEach, describe, expect, it, vi } from "vitest";

const panel = vi.hoisted(() => ({ deleteClient: vi.fn(), getByEmail: vi.fn() }));
const profiles = vi.hoisted(() => ({ findActiveByUserId: vi.fn(), revoke: vi.fn() }));
const slots = vi.hoisted(() => ({ deleteAllForProfile: vi.fn() }));
const logger = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

vi.mock("@/config/unifiedConfig.js", () => ({ config: { vpn: { subPublicBaseUrl: "https://x/api/v1/vpn/sub/", subBaseUrl: "https://p/" } } }));
vi.mock("@/lib/logger.js", () => ({ logger }));
vi.mock("@/services/vpnPanelService.js", () => ({ vpnPanelService: panel }));
vi.mock("@/repositories/VpnProfileRepository.js", () => ({ vpnProfileRepository: profiles }));
vi.mock("@/repositories/VpnAwgSlotRepository.js", () => ({ vpnAwgSlotRepository: slots }));
vi.mock("@/repositories/UserRepository.js", () => ({ userRepository: {} }));

import { vpnService } from "@/services/vpnService.js";

const PROFILE = { id: "p1", panelEmail: "i.ivanov", awgAuxPanelEmail: "i.ivanov-AWG2", awgAuxSubId: "hidden" };

describe("vpnService.revokeProfile (увольнение, AmneziaWG)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profiles.findActiveByUserId.mockResolvedValue(PROFILE);
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
    panel.getByEmail.mockResolvedValue({ email: "i.ivanov-AWG2" });
    await vpnService.revokeProfile("u1");
    expect(profiles.revoke).not.toHaveBeenCalled();
    expect(slots.deleteAllForProfile).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ panelEmail: "i.ivanov-AWG2" }), expect.any(String));
  });

  it("клиента на панели уже нет — считается удалённым", async () => {
    panel.deleteClient.mockRejectedValueOnce(new Error("not found")).mockResolvedValueOnce(undefined);
    panel.getByEmail.mockResolvedValue(null);
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
});
