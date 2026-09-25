import { logger } from "@/lib/logger.js";

/** Реальная жалоба пользователей 2026-09-25: приложение (Happ и т.п.) скачивает
 * geoip.dat/geosite.dat НАПРЯМУЮ с github.com — ещё до установки VPN-туннеля,
 * поэтому у многих российских провайдеров это скачивание виснет/не проходит
 * (github у части провайдеров недоступен без уже работающего VPN — классическая
 * проблема курицы и яйца). Наш сервер до GitHub достаёт нормально (проверено
 * вживую), а клиент уже и так обращается к НАШЕМУ домену за самой подпиской —
 * поэтому зеркалируем эти два файла через себя и переписываем на них ссылки в
 * Routing-конфиге (см. vpnService.rewriteRoutingGeoUrls). */

const GEOIP_URL = "https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest/download/geoip.dat";
const GEOSITE_URL = "https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest/download/geosite.dat";

/** Раз в сутки достаточно — сам апстрим (Loyalsoldier/v2ray-rules-dat) обновляется
 * с похожей частотой, а geoip/geosite не требуют мгновенной свежести. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CachedFile {
  body: ArrayBuffer;
  fetchedAt: number;
}

export type GeoDataKind = "geoip" | "geosite";

const SOURCE_URLS: Record<GeoDataKind, string> = { geoip: GEOIP_URL, geosite: GEOSITE_URL };

export class VpnGeoDataService {
  private cache = new Map<GeoDataKind, CachedFile>();
  /** Одновременные запросы за одним и тем же файлом (частый случай — несколько
   * сотрудников подключаются в один момент) не должны бить в GitHub параллельно —
   * дожидаются одного и того же в процессе запроса. */
  private inFlight = new Map<GeoDataKind, Promise<CachedFile>>();

  async get(kind: GeoDataKind): Promise<ArrayBuffer> {
    const cached = this.cache.get(kind);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.body;
    }

    const pending = this.inFlight.get(kind);
    if (pending) return (await pending).body;

    const fetchPromise = this.fetchAndCache(kind, cached);
    this.inFlight.set(kind, fetchPromise);
    try {
      return (await fetchPromise).body;
    } finally {
      this.inFlight.delete(kind);
    }
  }

  private async fetchAndCache(kind: GeoDataKind, stale: CachedFile | undefined): Promise<CachedFile> {
    try {
      const res = await fetch(SOURCE_URLS[kind], { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`upstream вернул ${res.status}`);
      const body = await res.arrayBuffer();
      const fresh: CachedFile = { body, fetchedAt: Date.now() };
      this.cache.set(kind, fresh);
      return fresh;
    } catch (error) {
      // Best-effort: апстрим GitHub временно недоступен даже нам — отдаём то, что
      // уже закешировано (пусть и просроченное), лишь бы не оставить сотрудников
      // совсем без geoip/geosite. Падаем только если вообще нечего отдать.
      if (stale) {
        logger.warn({ err: error, kind }, "vpnGeoDataService: обновление не удалось, отдаём закешированную версию");
        return stale;
      }
      logger.error({ err: error, kind }, "vpnGeoDataService: не удалось получить файл, кеш пуст");
      throw error;
    }
  }
}

export const vpnGeoDataService = new VpnGeoDataService();
