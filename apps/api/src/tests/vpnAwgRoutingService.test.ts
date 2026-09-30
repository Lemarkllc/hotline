import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { VpnAwgRoutingService } from "@/services/vpnAwgRoutingService.js";

// Синтетический geoip.dat с одной категорией RU (77.88.8.0/24).
const RU_GEOIP = Uint8Array.from([
  0x0a, 0x0e, // GeoIPList.entry, len 14
  0x0a, 0x02, 0x52, 0x55, // country_code "RU"
  0x12, 0x08, // cidr, len 8
  0x0a, 0x04, 77, 88, 8, 0, // ip
  0x10, 24, // prefix
]);

function loaderWith(fetchedAtRef: { value: number }) {
  return vi.fn(async () => ({ body: RU_GEOIP.buffer.slice(0) as ArrayBuffer, fetchedAt: fetchedAtRef.value }));
}

describe("VpnAwgRoutingService (кеш AllowedIPs по загрузке geoip.dat)", () => {
  it("тот же файл — тот же результат без пересчёта", async () => {
    const service = new VpnAwgRoutingService(loaderWith({ value: 1 }));
    const first = await service.getAllowedIps();
    const second = await service.getAllowedIps();
    expect(second).toBe(first);
    expect(first.length).toBeGreaterThan(0);
  });

  it("файл обновился — пересчитывается", async () => {
    const fetchedAt = { value: 1 };
    const service = new VpnAwgRoutingService(loaderWith(fetchedAt));
    const first = await service.getAllowedIps();
    fetchedAt.value = 2;
    const second = await service.getAllowedIps();
    expect(second).not.toBe(first);
    expect(second).toEqual(first);
  });

  it("одновременные запросы делят один расчёт", async () => {
    const service = new VpnAwgRoutingService(loaderWith({ value: 1 }));
    const [a, b] = await Promise.all([service.getAllowedIps(), service.getAllowedIps()]);
    expect(a).toBe(b);
  });
});
