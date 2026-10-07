/** Понятное описание устройства VPN-подписки из того, что панель сохраняет по заголовкам
 * приложения (User-Agent, X-Device-OS, X-Ver-OS, X-Device-Model). Сырые значения
 * трудно узнать: "iPhone12,1" (это iPhone 11), "Windows 10_10.0.19045",
 * "LMKW10WS-01_x86_64", INCY на Mac выдаёт себя за iPad — найдено на проде 2026-10-07. */

export type VpnDeviceKind = "phone" | "tablet" | "computer" | "unknown";

export interface VpnDeviceLabel {
  kind: VpnDeviceKind;
  /** «iPhone 11», «Mac», «Компьютер LMKW10WS-01», «Android-устройство SM-A525F». */
  name: string;
  /** «Happ», «INCY». */
  app: string;
  appVersion: string | null;
  /** «iOS 18.7.8», «Windows 10», «macOS 26.6». */
  os: string | null;
}

/** Коды моделей Apple → маркетинговые названия (только iPhone; неизвестный код показываем как есть). */
const IPHONE_MODELS: Record<string, string> = {
  "10,1": "iPhone 8", "10,4": "iPhone 8", "10,2": "iPhone 8 Plus", "10,5": "iPhone 8 Plus", "10,3": "iPhone X", "10,6": "iPhone X",
  "11,2": "iPhone XS", "11,4": "iPhone XS Max", "11,6": "iPhone XS Max", "11,8": "iPhone XR",
  "12,1": "iPhone 11", "12,3": "iPhone 11 Pro", "12,5": "iPhone 11 Pro Max", "12,8": "iPhone SE (2-го поколения)",
  "13,1": "iPhone 12 mini", "13,2": "iPhone 12", "13,3": "iPhone 12 Pro", "13,4": "iPhone 12 Pro Max",
  "14,4": "iPhone 13 mini", "14,5": "iPhone 13", "14,2": "iPhone 13 Pro", "14,3": "iPhone 13 Pro Max", "14,6": "iPhone SE (3-го поколения)",
  "14,7": "iPhone 14", "14,8": "iPhone 14 Plus", "15,2": "iPhone 14 Pro", "15,3": "iPhone 14 Pro Max",
  "15,4": "iPhone 15", "15,5": "iPhone 15 Plus", "16,1": "iPhone 15 Pro", "16,2": "iPhone 15 Pro Max",
  "17,3": "iPhone 16", "17,4": "iPhone 16 Plus", "17,1": "iPhone 16 Pro", "17,2": "iPhone 16 Pro Max", "17,5": "iPhone 16e",
};

/** Служебная обёртка нашего прокси: "HotLineMergeFetcher (INCY/2.6.2/ios …)" → "INCY/2.6.2/ios …". */
function unwrapUserAgent(userAgent: string | undefined, mergeFetcherUa: string): string {
  const ua = (userAgent ?? "").trim();
  const wrapped = ua.match(new RegExp(`^${mergeFetcherUa} \\((.+)\\)$`));
  return wrapped ? wrapped[1]! : ua;
}

function windowsName(version: string): string {
  // "10_10.0.19045" / "10.0.22631": сборка 22000+ — Windows 11 (Microsoft оставила "10.0").
  const build = Number(version.match(/10\.0\.(\d+)/)?.[1] ?? NaN);
  if (build >= 22000) return "Windows 11";
  if (Number.isFinite(build)) return "Windows 10";
  return `Windows ${version.split("_")[0]}`.trim();
}

export function describeVpnDevice(
  d: { userAgent?: string; deviceOs?: string; osVersion?: string; deviceModel?: string },
  mergeFetcherUa: string,
): VpnDeviceLabel {
  const [appRaw, appVersionRaw] = unwrapUserAgent(d.userAgent, mergeFetcherUa).split("/");
  const app = appRaw?.trim() || "Неизвестное приложение";
  const appVersion = appVersionRaw?.trim() || null;
  const osRaw = (d.deviceOs ?? "").trim();
  const version = (d.osVersion ?? "").trim();
  const model = (d.deviceModel ?? "").trim();
  const osLower = osRaw.toLowerCase();

  // iOS-приложение на Mac (INCY): ОС "macOS (Designed for iPad)", модель — выдуманный iPad.
  if (osLower.startsWith("macos")) {
    return { kind: "computer", name: "Mac", app, appVersion, os: version ? `macOS ${version}` : "macOS" };
  }
  if (osLower === "windows") {
    const host = model.replace(/_(x86_64|amd64|arm64|x86|i386)$/i, "");
    return { kind: "computer", name: host ? `Компьютер ${host}` : "Компьютер", app, appVersion, os: windowsName(version) };
  }
  if (osLower === "linux") {
    return { kind: "computer", name: model ? `Компьютер ${model}` : "Компьютер", app, appVersion, os: version ? `Linux ${version}` : "Linux" };
  }

  const os = osRaw ? [osRaw, version].filter(Boolean).join(" ") : null;
  const appleCode = model.match(/^(iPhone|iPad)(\d+,\d+)$/);
  if (appleCode) {
    const name = appleCode[1] === "iPhone" ? (IPHONE_MODELS[appleCode[2]!] ?? model) : "iPad";
    return { kind: appleCode[1] === "iPhone" ? "phone" : "tablet", name, app, appVersion, os };
  }
  if (/^iPad/i.test(model) || osLower === "ipados") return { kind: "tablet", name: model || "iPad", app, appVersion, os };
  if (/^iPhone/i.test(model) || osLower === "ios") return { kind: "phone", name: model || "iPhone", app, appVersion, os };
  if (osLower === "android") return { kind: "phone", name: model ? `Android · ${model}` : "Android-устройство", app, appVersion, os };
  return { kind: "unknown", name: model || "Устройство", app, appVersion, os };
}
