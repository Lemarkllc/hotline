import { logger } from "@/lib/logger.js";
import {
  VPN_AWG_DIRECT_CIDRS,
  VPN_AWG_FORCE_TUNNEL_CIDRS,
  VPN_AWG_GEOIP_COUNTRY,
  VPN_AWG_MAX_TUNNEL_ROUTES,
  VPN_AWG_RU_IPV4_COMPACT_PREFIX,
} from "@/config/vpnConfig.js";
import { vpnGeoDataService, type CachedFile } from "@/services/vpnGeoDataService.js";
import { computeAwgAllowedIps } from "@/utils/awgAllowedIps.js";
import { loadGeoIpCountry } from "@/utils/geoipDat.js";

/** AllowedIPs для AmneziaWG «RU напрямую» с кешем: разбор 16 МБ geoip.dat и расчёт
 * ~9 тыс. маршрутов (≈0,1 с) делаем один раз на каждую загрузку файла
 * (vpnGeoDataService обновляет его раз в сутки), а не на каждый запрос подписки. */
export class VpnAwgRoutingService {
  private cached: { fetchedAt: number; allowedIps: readonly string[] } | null = null;
  private inFlight: Promise<readonly string[]> | null = null;

  constructor(private readonly loadGeoIp: () => Promise<CachedFile> = () => vpnGeoDataService.getWithFetchedAt("geoip")) {}

  async getAllowedIps(): Promise<readonly string[]> {
    const geoip = await this.loadGeoIp();
    if (this.cached && this.cached.fetchedAt === geoip.fetchedAt) return this.cached.allowedIps;
    if (this.inFlight) return this.inFlight;

    this.inFlight = Promise.resolve().then(() => {
      const allowedIps = computeAwgAllowedIps({
        ruNetworks: loadGeoIpCountry(new Uint8Array(geoip.body), VPN_AWG_GEOIP_COUNTRY),
        directCidrs: VPN_AWG_DIRECT_CIDRS,
        forceTunnelCidrs: VPN_AWG_FORCE_TUNNEL_CIDRS,
        ipv4CompactPrefix: VPN_AWG_RU_IPV4_COMPACT_PREFIX,
        maxRoutes: VPN_AWG_MAX_TUNNEL_ROUTES,
      });
      this.cached = { fetchedAt: geoip.fetchedAt, allowedIps };
      logger.info({ routes: allowedIps.length }, "vpnAwgRoutingService: AllowedIPs для AmneziaWG пересчитан");
      return allowedIps;
    });
    try {
      return await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }
}

export const vpnAwgRoutingService = new VpnAwgRoutingService();
