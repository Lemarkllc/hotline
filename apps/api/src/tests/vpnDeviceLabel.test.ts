import { describe, expect, it } from "vitest";
import { describeVpnDevice } from "@/utils/vpnDeviceLabel.js";

const UA = "HotLineMergeFetcher";

/** Примеры — реальные записи панели (прод, 2026-10-07). */
describe("describeVpnDevice", () => {
  it("код модели iPhone — маркетинговое название", () => {
    expect(describeVpnDevice({ userAgent: "SecureOrbit/1.0.3/ios/1", deviceOs: "iOS", osVersion: "17.6.1", deviceModel: "iPhone12,1" }, UA)).toEqual({
      kind: "phone",
      name: "iPhone 11",
      app: "SecureOrbit",
      appVersion: "1.0.3",
      os: "iOS 17.6.1",
    });
  });

  it("уже понятная модель iPhone остаётся", () => {
    expect(describeVpnDevice({ userAgent: "Happ/4.12.0/ios/26", deviceOs: "iOS", osVersion: "18.7.8", deviceModel: "iPhone 12" }, UA)).toMatchObject({
      kind: "phone",
      name: "iPhone 12",
      app: "Happ",
      appVersion: "4.12.0",
    });
  });

  it("Windows: имя компьютера без архитектуры, версия по сборке", () => {
    expect(describeVpnDevice({ userAgent: "Happ/2.1.0/Windows", deviceOs: "Windows", osVersion: "10_10.0.19045", deviceModel: "LMKW10WS-01_x86_64" }, UA)).toEqual({
      kind: "computer",
      name: "Компьютер LMKW10WS-01",
      app: "Happ",
      appVersion: "2.1.0",
      os: "Windows 10",
    });
    expect(describeVpnDevice({ deviceOs: "Windows", osVersion: "10.0.22631", deviceModel: "PC" }, UA).os).toBe("Windows 11");
  });

  it("INCY на Mac выдаёт себя за iPad — показываем Mac", () => {
    expect(
      describeVpnDevice(
        { userAgent: "INCY/2.6.2/macos CFNetwork/3860.700.1", deviceOs: "macOS (Designed for iPad)", osVersion: "26.6", deviceModel: "iPad Pro (12.9-inch) (3rd generation)" },
        UA,
      ),
    ).toMatchObject({ kind: "computer", name: "Mac", app: "INCY", os: "macOS 26.6" });
  });

  it("служебный User-Agent прокси разворачивается", () => {
    expect(describeVpnDevice({ userAgent: "HotLineMergeFetcher (INCY/2.6.2/ios CFNetwork/3860)", deviceOs: "iOS" }, UA)).toMatchObject({ app: "INCY", appVersion: "2.6.2" });
  });

  it("Android и пустые данные", () => {
    expect(describeVpnDevice({ userAgent: "v2rayNG/1.9", deviceOs: "Android", osVersion: "14", deviceModel: "SM-A525F" }, UA)).toMatchObject({ kind: "phone", name: "Android · SM-A525F", os: "Android 14" });
    expect(describeVpnDevice({}, UA)).toEqual({ kind: "unknown", name: "Устройство", app: "Неизвестное приложение", appVersion: null, os: null });
  });
});
