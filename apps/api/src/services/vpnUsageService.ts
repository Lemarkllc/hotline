import { logger } from "@/lib/logger.js";
import { vpnProfileRepository } from "@/repositories/VpnProfileRepository.js";
import { vpnUsageSnapshotRepository } from "@/repositories/VpnUsageSnapshotRepository.js";
import { vpnPanelService } from "@/services/vpnPanelService.js";

/** Снимок раз в сутки после 03:00 МСК — ночью, когда панель почти не нагружена. */
const SNAPSHOT_HOUR_MSK = 3;
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Московский день `now` как полночь UTC (так хранится @db.Date) и час по Москве. */
export function mskDay(now: Date): { day: Date; hour: number } {
  const msk = new Date(now.getTime() + MSK_OFFSET_MS);
  return { day: new Date(Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate())), hour: msk.getUTCHours() };
}

/**
 * Суточные снимки трафика и устройств для раздела «VPN» Администратора (VpnUsageSnapshot):
 * панель не хранит историю, «за 30 дней» считаем сами по этим снимкам (utils/vpnTraffic.ts).
 * Нагрузка минимальная (урок 2026-10-05 — API-ВМ слабая): один clients/list и по одному
 * запросу устройств на профиль, строго последовательно.
 */
export class VpnUsageService {
  /** Вызывается раз в час (server.ts); снимает только один раз за московские сутки. */
  async takeDailySnapshotIfDue(now = new Date()): Promise<{ taken: boolean; saved?: number; skipped?: number; failed?: number }> {
    const { day, hour } = mskDay(now);
    if (hour < SNAPSHOT_HOUR_MSK) return { taken: false };
    if (await vpnUsageSnapshotRepository.hasAnyForDay(day)) return { taken: false };

    const clients = new Map((await vpnPanelService.listAllClients()).map((c) => [c.email, c]));
    const result = { taken: true, saved: 0, skipped: 0, failed: 0 };
    for (const profile of await vpnProfileRepository.findAllActive()) {
      const main = clients.get(profile.panelEmail);
      // Устаревший профиль (клиента нет или логин занят чужим) — его счётчики не наши.
      if (!main || main.subId !== profile.subId) {
        result.skipped++;
        continue;
      }
      try {
        let up = BigInt(main.up);
        let down = BigInt(main.down);
        for (const aux of profile.awgAuxClients) {
          const c = clients.get(aux.panelEmail);
          if (c?.subId === aux.subId) {
            up += BigInt(c.up);
            down += BigInt(c.down);
          }
        }
        const deviceCount = (await vpnPanelService.listDevices(profile.panelEmail)).length;
        await vpnUsageSnapshotRepository.upsertDay({ profileId: profile.id, day, upBytes: up, downBytes: down, deviceCount });
        result.saved++;
      } catch (error) {
        result.failed++;
        logger.error({ err: error, panelEmail: profile.panelEmail }, "vpnUsageService: снимок по профилю не сохранён");
      }
    }
    logger.info(result, "vpnUsageService: суточный снимок трафика VPN");
    return result;
  }
}

export const vpnUsageService = new VpnUsageService();
