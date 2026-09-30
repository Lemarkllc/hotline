import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  appendAmneziaWgElement,
  buildAmneziaWgServers,
  cleanServerName,
  extractAmneziaWgConfigs,
  isIncyUserAgent,
  parseVpnLink,
} from "@/utils/amneziaWgSubscription.js";

const SAMPLE = readFileSync(new URL("./fixtures/amneziawg-sample.conf", import.meta.url), "utf-8");
const vpnLink = (conf: string) => `vpn://${Buffer.from(conf, "utf-8").toString("base64url")}`;
const PLAIN_WG = SAMPLE.split("\n").filter((l) => !/^(Jc|Jmin|Jmax|S\d|H\d|I\d|HeaderProtectionKey|ContentPaddingAddition)\s*=/.test(l)).join("\n");

describe("isIncyUserAgent", () => {
  it.each([
    ["INCY/1.2", true],
    ["incy", true],
    ["Incy 3.0 (iOS)", true],
    ["Happ/1.0", false],
    ["incyx", false],
    [undefined, false],
  ])("%s → %s", (ua, expected) => {
    expect(isIncyUserAgent(ua)).toBe(expected);
  });
});

describe("parseVpnLink / extractAmneziaWgConfigs", () => {
  it("vpn:// с AmneziaWG — имя без трафика, конфиг целиком", () => {
    const parsed = parseVpnLink(vpnLink(SAMPLE));
    expect(parsed?.name).toBe("AMN");
    expect(parsed?.conf).toBe(SAMPLE);
  });

  it("обычный WireGuard без параметров AmneziaWG отбрасывается", () => {
    expect(parseVpnLink(vpnLink(PLAIN_WG))).toBeNull();
  });

  it("из сырой подписки (base64) берутся только AmneziaWG, дубли убираются", () => {
    const raw = Buffer.from([vpnLink(SAMPLE), "vless://uuid@host:443#DE", vpnLink(SAMPLE)].join("\n")).toString("base64");
    const configs = extractAmneziaWgConfigs(raw);
    expect(configs).toHaveLength(1);
    expect(configs[0]!.name).toBe("AMN");
  });

  it("нет AmneziaWG — пустой список", () => {
    expect(extractAmneziaWgConfigs("vless://uuid@host:443#DE")).toEqual([]);
  });
});

describe("cleanServerName", () => {
  it.each([
    ["AMN - 1.76TB", "AMN"],
    ["AMN|📊1.76TB|⏳30d", "AMN"],
    ["AMN 📊1.76TB", "AMN"],
    ["AMN Finland — 850 ГБ", "AMN Finland"],
    ["AMN", "AMN"],
  ])("%s → %s", (source, expected) => {
    expect(cleanServerName(source)).toBe(expected);
  });
});

describe("buildAmneziaWgServers / appendAmneziaWgElement", () => {
  it("одинаковые имена различаются суффиксом, config — base64url без '='", () => {
    const servers = buildAmneziaWgServers([
      { name: "AMN", conf: SAMPLE },
      { name: "AMN", conf: `${SAMPLE}\n` },
    ]);
    expect(servers.map((s) => s.name)).toEqual(["AMN", "AMN #2"]);
    expect(servers[0]!.config).not.toMatch(/[=+/]/);
    expect(Buffer.from(servers[0]!.config, "base64url").toString("utf-8")).toBe(SAMPLE);
  });

  it("элемент amneziawg дописывается в конец массива; объект оборачивается", () => {
    const servers = [{ name: "AMN", config: "abc" }];
    expect(appendAmneziaWgElement([{ remarks: "DE" }], servers)).toEqual([
      { remarks: "DE" },
      { type: "amneziawg", version: 1, servers },
    ]);
    expect(appendAmneziaWgElement({ remarks: "DE" }, servers)).toHaveLength(2);
  });
});
