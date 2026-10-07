import type { User, VpnAwgAuxClient, VpnProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma.js";

export class VpnProfileRepository {
  /** Только активный (не отозванный) профиль — отозванные не считаются "уже есть
   * профиль" при повторном "Получить VPN" (по факту такого случая ещё не бывает,
   * профиль отзывается только при увольнении, но защита на будущее дешева). */
  findActiveByUserId(userId: string): Promise<VpnProfile | null> {
    return prisma.vpnProfile.findFirst({ where: { userId, revokedAt: null } });
  }

  /** С владельцем — для персонализации Profile-Title в прокси подписки
   * (vpnService.proxySubscription). Только активный: отозванный subId мог быть
   * переиспользован формально панелью, но у нас это уже не "тот" профиль. */
  findActiveBySubId(subId: string): Promise<(VpnProfile & { user: User }) | null> {
    return prisma.vpnProfile.findFirst({ where: { subId, revokedAt: null }, include: { user: true } });
  }

  create(data: { userId: string; panelEmail: string; subId: string; deviceLimit: number }): Promise<VpnProfile> {
    return prisma.vpnProfile.create({ data });
  }

  setDeviceLimit(id: string, deviceLimit: number): Promise<VpnProfile> {
    return prisma.vpnProfile.update({ where: { id }, data: { deviceLimit } });
  }

  /** Бэкфилл, ночные снимки, раздел администратора — с владельцем и aux-клиентами. */
  findAllActive(): Promise<(VpnProfile & { user: User; awgAuxClients: VpnAwgAuxClient[] })[]> {
    return prisma.vpnProfile.findMany({
      where: { revokedAt: null },
      include: { user: true, awgAuxClients: { orderBy: { slot: "asc" } } },
    });
  }

  revoke(id: string): Promise<VpnProfile> {
    return prisma.vpnProfile.update({ where: { id }, data: { revokedAt: new Date() } });
  }
}

export const vpnProfileRepository = new VpnProfileRepository();
