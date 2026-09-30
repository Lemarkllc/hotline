/** Routing-заголовок подписки для Happ: happ://routing/<add|onadd>/<base64 JSON>.
 *
 * Панель отдаёт его с `add/`, а по документации Happ (happ.su/main/dev-docs/routing)
 * `add/` лишь добавляет профиль в список — активным он становится, только если это
 * ПЕРВЫЙ профиль у пользователя. Реальная жалоба 2026-09-30: у сотрудников, у
 * которых в Happ уже был чужой профиль маршрутизации (например, от другого
 * VPN-провайдера), наш "LemarkLLC" появлялся в списке, но не включался — трафик
 * шёл по чужим правилам. `onadd/` добавляет и сразу активирует профиль, даже если
 * активен другой, — поэтому всегда отдаём `onadd/`.
 *
 * Заодно подменяем Geoipurl/Geositeurl на наше зеркало (см. vpnGeoDataService,
 * жалоба 2026-09-25 — github.com недоступен клиенту до установки туннеля).
 *
 * Возвращает null, если формат заголовка неожиданный — вызывающий оставляет
 * заголовок как пришёл от панели, не ломая подписку ради этой правки. */
const ROUTING_PREFIXES = ["happ://routing/onadd/", "happ://routing/add/"] as const;
const ACTIVATING_PREFIX = "happ://routing/onadd/";

export function rewriteHappRoutingHeader(value: string, publicOrigin: string): string | null {
  const prefix = ROUTING_PREFIXES.find((p) => value.startsWith(p));
  if (!prefix) return null;

  try {
    const decoded = JSON.parse(Buffer.from(value.slice(prefix.length), "base64").toString("utf-8"));
    if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) return null;
    decoded.Geoipurl = `${publicOrigin}/api/v1/vpn/geoip.dat`;
    decoded.Geositeurl = `${publicOrigin}/api/v1/vpn/geosite.dat`;
    return `${ACTIVATING_PREFIX}${Buffer.from(JSON.stringify(decoded), "utf-8").toString("base64")}`;
  } catch {
    return null;
  }
}
