import { prisma } from "@/lib/prisma.js";

export class PushSubscriptionRepository {
  upsert(userId: string, endpoint: string, p256dh: string, auth: string) {
    return prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId, p256dh, auth },
      create: { userId, endpoint, p256dh, auth },
    });
  }

  deleteByEndpoint(endpoint: string) {
    return prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }

  listByUserId(userId: string) {
    return prisma.pushSubscription.findMany({ where: { userId } });
  }
}

export const pushSubscriptionRepository = new PushSubscriptionRepository();
