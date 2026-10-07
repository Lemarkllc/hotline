import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyAllowedIps, computeAwgAllowedIps, ensurePersistentKeepalive } from "@/utils/awgAllowedIps.js";
import { complement, intervalToCidrs, mergeIntervals, parseCidr, type IpInterval } from "@/utils/cidr.js";
import { loadGeoIpCountry } from "@/utils/geoipDat.js";
import { VPN_AWG_DIRECT_CIDRS, VPN_AWG_FORCE_TUNNEL_CIDRS } from "@/config/vpnConfig.js";

// ---- минимальный protobuf-энкодер для синтетического geoip.dat ----
function varint(n: number): number[] {
  const out: number[] = [];
  while (n > 0x7f) {
    out.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  out.push(n);
  return out;
}
function bytesField(field: number, payload: number[]): number[] {
  return [...varint((field << 3) | 2), ...varint(payload.length), ...payload];
}
function cidrMsg(ip: number[], prefix: number): number[] {
  return [...bytesField(1, ip), ...varint((2 << 3) | 0), ...varint(prefix)];
}
function geoEntry(code: string, cidrs: number[][]): number[] {
  return [...bytesField(1, [...Buffer.from(code)]), ...cidrs.flatMap((c) => bytesField(2, c))];
}
function geoList(entries: number[][]): Uint8Array {
  return Uint8Array.from(entries.flatMap((e) => bytesField(1, e)));
}

/** Покрывается ли адрес хотя бы одной сетью из списка. */
function covered(list: string[], address: string): boolean {
  const target = parseCidr(address);
  return list.some((cidr) => {
    const n = parseCidr(cidr);
    return n.version === target.version && n.start <= target.start && target.end <= n.end;
  });
}

const BASE = {
  directCidrs: VPN_AWG_DIRECT_CIDRS,
  forceTunnelCidrs: VPN_AWG_FORCE_TUNNEL_CIDRS,
  ipv4CompactPrefix: 19,
  maxRoutes: 12000,
};

describe("cidr", () => {
  it("разбор, слияние смежных и обратное разложение", () => {
    const merged = mergeIntervals([parseCidr("10.0.0.0/25"), parseCidr("10.0.0.128/25")]);
    expect(merged.flatMap(intervalToCidrs)).toEqual(["10.0.0.0/24"]);
  });

  it("дополнение IPv4 без исключений — весь диапазон", () => {
    expect(complement([], 4).flatMap(intervalToCidrs)).toEqual(["0.0.0.0/0"]);
  });

  it("дополнение IPv6 минус fc00::/7 даёт каноничную запись", () => {
    const list = complement([parseCidr("fc00::/7")], 6).flatMap(intervalToCidrs);
    expect(list).toContain("::/1");
    expect(list).toContain("fe00::/7");
  });

  it("некорректный CIDR — ошибка", () => {
    expect(() => parseCidr("300.0.0.0/8")).toThrow();
    expect(() => parseCidr("10.0.0.0/33")).toThrow();
  });
});

describe("loadGeoIpCountry (geoip.dat)", () => {
  const data = geoList([
    geoEntry("US", [cidrMsg([8, 8, 8, 0], 24)]),
    geoEntry("RU", [cidrMsg([77, 88, 0, 0], 18), cidrMsg([0x2a, 0x02, 0x06, 0xb8, ...Array(12).fill(0)], 32)]),
    geoEntry("CN", []),
  ]);

  it("находит категорию без учёта регистра, IPv4 и IPv6", () => {
    const nets = loadGeoIpCountry(data, "ru");
    expect(nets.flatMap(intervalToCidrs)).toEqual(["77.88.0.0/18", "2a02:6b8::/32"]);
  });

  it("категории нет — ошибка", () => {
    expect(() => loadGeoIpCountry(data, "DE")).toThrow(/не найдена/);
  });

  it("категория пустая — ошибка", () => {
    expect(() => loadGeoIpCountry(data, "CN")).toThrow(/пустая/);
  });

  it("обрезанный varint — ошибка", () => {
    expect(() => loadGeoIpCountry(Uint8Array.from([0x0a, 0xff]), "RU")).toThrow(/varint/);
  });
});

describe("computeAwgAllowedIps (AmneziaWG «RU напрямую»)", () => {
  const ru: IpInterval[] = [parseCidr("77.88.8.0/24"), parseCidr("149.154.170.0/24"), parseCidr("2a02:6b8::/32")];
  const list = computeAwgAllowedIps({ ruNetworks: ru, ...BASE });

  it("российский адрес идёт напрямую — не покрыт", () => {
    expect(covered(list, "77.88.8.8")).toBe(false);
  });

  it("соседний адрес в той же /19 тоже напрямую (компромисс укрупнения)", () => {
    expect(covered(list, "77.88.31.1")).toBe(false);
    expect(covered(list, "77.88.32.1")).toBe(true);
  });

  it("Telegram всегда в туннеле, даже внутри укрупнённой RU /19", () => {
    expect(covered(list, "149.154.160.0/20")).toBe(true);
  });

  it("корпоративные адреса: .252 напрямую, .253 в туннеле", () => {
    expect(covered(list, "62.210.70.252")).toBe(false);
    expect(covered(list, "62.210.70.253")).toBe(true);
  });

  it("локальные сети мимо туннеля, обычный зарубежный адрес — в туннеле", () => {
    expect(covered(list, "192.168.1.1")).toBe(false);
    expect(covered(list, "10.1.2.3")).toBe(false);
    expect(covered(list, "8.8.8.8")).toBe(true);
  });

  it("публичный IPv6 целиком в туннеле, включая RU IPv6; локальный — нет", () => {
    expect(covered(list, "2000::/3")).toBe(true);
    expect(covered(list, "2a02:6b8::1")).toBe(true);
    expect(covered(list, "fd00::1")).toBe(false);
  });

  it("превышение предела маршрутов — ошибка", () => {
    expect(() => computeAwgAllowedIps({ ruNetworks: ru, ...BASE, maxRoutes: 5 })).toThrow(/слишком длинный/);
  });
});

describe("applyAllowedIps", () => {
  const sample = readFileSync(new URL("./fixtures/amneziawg-sample.conf", import.meta.url), "utf-8");

  it("заменяет единственную строку AllowedIPs, остальное без изменений", () => {
    const result = applyAllowedIps(sample, ["1.0.0.0/8", "::/1"]);
    expect(result).toContain("AllowedIPs = 1.0.0.0/8, ::/1");
    expect(result).not.toContain("0.0.0.0/0");
    expect(result.replace(/^AllowedIPs.*$/m, "")).toBe(sample.replace(/^AllowedIPs.*$/m, ""));
  });

  it("нет строки AllowedIPs — ошибка", () => {
    expect(() => applyAllowedIps(sample.replace(/^AllowedIPs.*$/m, ""), ["1.0.0.0/8"])).toThrow(/найдено 0/);
  });

  it("две строки AllowedIPs — ошибка", () => {
    expect(() => applyAllowedIps(`${sample}\nAllowedIPs = 10.0.0.0/8\n`, ["1.0.0.0/8"])).toThrow(/найдено 2/);
  });
});

describe("ensurePersistentKeepalive", () => {
  const sample = readFileSync(new URL("./fixtures/amneziawg-sample.conf", import.meta.url), "utf-8");
  const peerSection = (conf: string) => conf.slice(conf.indexOf("[Peer]"));

  it("добавляет строку в секцию [Peer], остальное без изменений", () => {
    const result = ensurePersistentKeepalive(sample, 25);
    expect(peerSection(result)).toMatch(/^PersistentKeepalive = 25$/m);
    expect(result.replace(/^PersistentKeepalive = 25\n?/m, "")).toBe(sample);
    expect(result.indexOf("PersistentKeepalive")).toBeGreaterThan(result.indexOf("Endpoint"));
  });

  it("уже заданное значение не трогает и не дублирует", () => {
    const withValue = `${sample.trimEnd()}\nPersistentKeepalive = 15\n`;
    const result = ensurePersistentKeepalive(withValue, 25);
    expect(result).toBe(withValue);
    expect(result.match(/PersistentKeepalive/g)).toHaveLength(1);
  });

  it("строка в [Interface] не считается — добавляет в [Peer]", () => {
    const weird = sample.replace("[Interface]", "[Interface]\nPersistentKeepalive = 5");
    expect(peerSection(ensurePersistentKeepalive(weird, 25))).toMatch(/^PersistentKeepalive = 25$/m);
  });

  it("нет [Peer] — ошибка", () => {
    expect(() => ensurePersistentKeepalive("[Interface]\nPrivateKey = x\n", 25)).toThrow(/\[Peer\]/);
  });
});
