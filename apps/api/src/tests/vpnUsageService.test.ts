import { beforeEach, describe, expect, it, vi } from "vitest";

const panel = vi.hoisted(() => ({ listAllClients: vi.fn(), listDevices: vi.fn() }));
const profiles = vi.hoisted(() => ({ findAllActive: vi.fn() }));
const snapshots = vi.hoisted(() => ({ hasAnyForDay: vi.fn(), upsertDay: vi.fn() }));

vi.mock("@/lib/logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/services/vpnPanelService.js", () => ({ vpnPanelService: panel }));
vi.mock("@/repositories/VpnProfileRepository.js", () => ({ vpnProfileRepository: profiles }));
vi.mock("@/repositories/VpnUsageSnapshotRepository.js", () => ({ vpnUsageSnapshotRepository: snapshots }));

import { mskDay, vpnUsageService } from "@/services/vpnUsageService.js";

/** 04:00 МСК 15 октября. */
const NIGHT = new Date("2026-10-15T01:00:00Z");
const client = (email: string, subId: string, up: number, down: number) => ({ email, subId, up, down, limitHwid: 2, enable: true, lastSubFetch: null });

describe("vpnUsageService.takeDailySnapshotIfDue", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    snapshots.hasAnyForDay.mockResolvedValue(false);
    panel.listDevices.mockResolvedValue([{ id: 1 }, { id: 2 }]);
  });

  it("московский день и час", () => {
    expect(mskDay(new Date("2026-10-14T22:30:00Z"))).toEqual({ day: new Date("2026-10-15T00:00:00Z"), hour: 1 });
  });

  it("до 03:00 МСК — пропуск", async () => {
    expect(await vpnUsageService.takeDailySnapshotIfDue(new Date("2026-10-14T23:00:00Z"))).toEqual({ taken: false });
    expect(panel.listAllClients).not.toHaveBeenCalled();
  });

  it("уже снят сегодня — пропуск, панель не трогается", async () => {
    snapshots.hasAnyForDay.mockResolvedValue(true);
    expect(await vpnUsageService.takeDailySnapshotIfDue(NIGHT)).toEqual({ taken: false });
    expect(panel.listAllClients).not.toHaveBeenCalled();
  });

  it("сумма основного и своих вспомогательных клиентов, устаревшие профили пропускаются", async () => {
    panel.listAllClients.mockResolvedValue([
      client("i.ivanov", "s1", 100, 1000),
      client("i.ivanov-AWG2", "a2", 10, 20),
      client("p.petrov", "someone-else", 5, 5),
    ]);
    profiles.findAllActive.mockResolvedValue([
      { id: "p1", panelEmail: "i.ivanov", subId: "s1", awgAuxClients: [{ panelEmail: "i.ivanov-AWG2", subId: "a2" }] },
      { id: "p2", panelEmail: "p.petrov", subId: "s2", awgAuxClients: [] },
    ]);
    const r = await vpnUsageService.takeDailySnapshotIfDue(NIGHT);
    expect(r).toMatchObject({ taken: true, saved: 1, skipped: 1 });
    expect(panel.listAllClients).toHaveBeenCalledTimes(1);
    expect(snapshots.upsertDay).toHaveBeenCalledWith({
      profileId: "p1",
      day: new Date("2026-10-15T00:00:00Z"),
      upBytes: 110n,
      downBytes: 1020n,
      deviceCount: 2,
    });
  });
});
