import { describe, expect, it } from "vitest";
import { rewriteHappRoutingHeader } from "@/utils/happRouting.js";

const ORIGIN = "https://hot.lemarkllc.ru";

function encode(prefix: string, profile: unknown): string {
  return `${prefix}${Buffer.from(JSON.stringify(profile), "utf-8").toString("base64")}`;
}

function decode(value: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(value.replace("happ://routing/onadd/", ""), "base64").toString("utf-8"));
}

const PROFILE = {
  Name: "LemarkLLC",
  GlobalProxy: "true",
  Geoipurl: "https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest/download/geoip.dat",
  Geositeurl: "https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest/download/geosite.dat",
  DirectSites: ["geosite:category-ru"],
};

describe("rewriteHappRoutingHeader (подписка VPN → Happ)", () => {
  it("add/ → onadd/, чтобы профиль активировался при уже активном чужом", () => {
    const result = rewriteHappRoutingHeader(encode("happ://routing/add/", PROFILE), ORIGIN);
    expect(result).not.toBeNull();
    expect(result!.startsWith("happ://routing/onadd/")).toBe(true);
  });

  it("geo-ссылки ведут на наше зеркало, остальной профиль не меняется", () => {
    const decoded = decode(rewriteHappRoutingHeader(encode("happ://routing/add/", PROFILE), ORIGIN)!);
    expect(decoded.Geoipurl).toBe(`${ORIGIN}/api/v1/vpn/geoip.dat`);
    expect(decoded.Geositeurl).toBe(`${ORIGIN}/api/v1/vpn/geosite.dat`);
    expect(decoded.Name).toBe("LemarkLLC");
    expect(decoded.DirectSites).toEqual(["geosite:category-ru"]);
  });

  it("onadd/ от панели тоже принимается и остаётся onadd/", () => {
    const result = rewriteHappRoutingHeader(encode("happ://routing/onadd/", PROFILE), ORIGIN);
    expect(result!.startsWith("happ://routing/onadd/")).toBe(true);
  });

  it("неизвестный формат → null (заголовок оставляем как есть)", () => {
    expect(rewriteHappRoutingHeader("something-else", ORIGIN)).toBeNull();
    expect(rewriteHappRoutingHeader("happ://routing/add/%%%не-base64", ORIGIN)).toBeNull();
    expect(rewriteHappRoutingHeader(encode("happ://routing/add/", ["массив"]), ORIGIN)).toBeNull();
  });
});
