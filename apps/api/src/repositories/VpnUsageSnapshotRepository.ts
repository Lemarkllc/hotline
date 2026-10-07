import type { VpnUsageSnapshot } from "@prisma/client";
import { prisma } from "@/lib/prisma.js";

/** Суточные снимки счётчиков панели (vpnUsageService) — один на профиль в день. */
export class VpnUsageSnapshotRepository {
  upsertDay(data: { profileId: string; day: Date; upBytes: bigint; downBytes: bigint; deviceCount: number }): Promise<VpnUsageSnapshot> {
    const { profileId, day, ...values } = data;
    return prisma.vpnUsageSnapshot.upsert({
      where: { profileId_day: { profileId, day } },
      create: { profileId, day, ...values },
      update: { ...values, takenAt: new Date() },
    });
  }

  /** Снимки профилей начиная с даты (включительно), по возрастанию дня. */
  listSince(profileIds: string[], since: Date): Promise<VpnUsageSnapshot[]> {
    return prisma.vpnUsageSnapshot.findMany({
      where: { profileId: { in: profileIds }, day: { gte: since } },
      orderBy: [{ profileId: "asc" }, { day: "asc" }],
    });
  }

  /** Был ли уже снимок за этот день хоть у одного профиля (ночная задача не повторяется). */
  async hasAnyForDay(day: Date): Promise<boolean> {
    return (await prisma.vpnUsageSnapshot.count({ where: { day } })) > 0;
  }
}

export const vpnUsageSnapshotRepository = new VpnUsageSnapshotRepository();
