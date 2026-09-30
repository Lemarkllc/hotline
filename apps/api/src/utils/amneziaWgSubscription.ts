/** AmneziaWG в подписке для INCY (перенесено из incy_merge.py, см. vpnService.proxySubscription).
 * Панель отдаёт AmneziaWG только в сыром списке ссылок (`vpn://<base64url conf>`), а в
 * JSON для Happ/INCY — нет; INCY умеет принимать их отдельным элементом JSON-массива
 * `{"type":"amneziawg","version":1,"servers":[{name, config}]}`. Здесь — чистые
 * функции разбора и сборки, без сети. */

export interface AmneziaWgServer {
  name: string;
  /** Полный конфиг AmneziaWG, base64url без выравнивания "=". */
  config: string;
}

export interface ParsedAmneziaWgConfig {
  name: string;
  conf: string;
}

/** Тот же шаблон, что subJsonUserAgentRegex панели для INCY. */
export function isIncyUserAgent(userAgent: string | undefined): boolean {
  return /^incy(?:[ /]|$)/i.test((userAgent ?? "").trim());
}

/** Сырая подписка бывает текстом, base64 или base64url — как в incy_merge.py. */
export function decodeRawSubscription(body: string): string {
  const text = body.trim();
  if (text.includes("://") || text.includes("[Interface]")) return text;
  const compact = text.replace(/\s+/g, "");
  for (const encoding of ["base64", "base64url"] as const) {
    const decoded = Buffer.from(compact, encoding).toString("utf-8");
    if (decoded.includes("://") || decoded.includes("[Interface]")) return decoded;
  }
  return text;
}

/** Хотя бы один из параметров, которых нет у обычного WireGuard. */
const AMNEZIA_MARKERS = /^\s*(Jc|Jmin|Jmax|S[1-4]|H[1-4]|I[1-5]|HeaderProtectionKey|ContentPaddingAddition)\s*=/m;

/** `vpn://…` → конфиг AmneziaWG с именем сервера; null — не AmneziaWG или битая ссылка. */
export function parseVpnLink(line: string): ParsedAmneziaWgConfig | null {
  if (!line.startsWith("vpn://")) return null;
  const payload = line.slice("vpn://".length).split("#", 1)[0]!.trim();
  const conf = Buffer.from(payload, "base64url").toString("utf-8");
  if (!conf.includes("[Interface]") || !conf.includes("[Peer]") || !/^\s*PrivateKey\s*=/m.test(conf)) return null;
  if (!AMNEZIA_MARKERS.test(conf)) return null;

  // Панель подписывает сервер комментарием прямо перед [Peer]: "# AMN - 1.76TB".
  const source =
    conf.match(/^#\s*(.+?)\s*\r?\n\[Peer\]\s*$/m)?.[1] ?? conf.match(/^\s*Endpoint\s*=\s*(.+?)\s*$/m)?.[1] ?? "";
  return { name: cleanServerName(source) || "AmneziaWG", conf };
}

/** "AMN - 1.76TB", "AMN|📊1.76TB|⏳…", "AMN 📊1.76TB" → "AMN". */
export function cleanServerName(value: string): string {
  return value
    .replace(/[   ]/g, " ")
    .replace(/[​‌‍⁠﻿]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim()
    .replace(/\s*\|\s*📊.*$/u, "")
    .replace(/\s*📊.*$/u, "")
    .replace(/\s*[-–—]\s*\d+(?:[.,]\d+)?\s*(?:B|KB|MB|GB|TB|PB|KiB|MiB|GiB|TiB|PiB|Б|КБ|МБ|ГБ|ТБ|ПБ)\s*$/i, "")
    .trim();
}

/** Все AmneziaWG-конфиги из сырой подписки, без дублей. */
export function extractAmneziaWgConfigs(rawBody: string): ParsedAmneziaWgConfig[] {
  const seen = new Set<string>();
  const result: ParsedAmneziaWgConfig[] = [];
  for (const line of decodeRawSubscription(rawBody).split(/\r?\n/)) {
    const parsed = parseVpnLink(line.trim());
    if (!parsed || seen.has(parsed.conf)) continue;
    seen.add(parsed.conf);
    result.push(parsed);
  }
  return result;
}

/** Готовые серверы для INCY: одинаковые имена различаются суффиксом "#2", "#3"… */
export function buildAmneziaWgServers(configs: readonly ParsedAmneziaWgConfig[]): AmneziaWgServer[] {
  const used = new Map<string, number>();
  return configs.map(({ name, conf }) => {
    const occurrence = (used.get(name) ?? 0) + 1;
    used.set(name, occurrence);
    return {
      name: occurrence === 1 ? name : `${name} #${occurrence}`,
      config: Buffer.from(conf, "utf-8").toString("base64url"),
    };
  });
}

/** Дописывает элемент AmneziaWG в JSON-подписку панели (объект оборачивается в массив,
 * как делает сама панель при subJsonAlwaysArray). */
export function appendAmneziaWgElement(jsonBody: unknown, servers: readonly AmneziaWgServer[]): unknown[] {
  const list = Array.isArray(jsonBody) ? [...jsonBody] : [jsonBody];
  list.push({ type: "amneziawg", version: 1, servers });
  return list;
}
