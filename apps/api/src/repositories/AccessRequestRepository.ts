import type { AccessRequest, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma.js";

export type AccessRequestWithUser = Prisma.AccessRequestGetPayload<{ include: { user: true } }>;

export class AccessRequestRepository {
  create(data: { userId: string; telegramId: bigint; fullName: string }): Promise<AccessRequest> {
    return prisma.accessRequest.create({ data });
  }

  findByUserId(userId: string): Promise<AccessRequest | null> {
    return prisma.accessRequest.findUnique({ where: { userId } });
  }

  findById(id: string): Promise<AccessRequest | null> {
    return prisma.accessRequest.findUnique({ where: { id } });
  }

  listPending(): Promise<AccessRequestWithUser[]> {
    return prisma.accessRequest.findMany({
      where: { status: "PENDING" },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });
  }

  decide(
    id: string,
    data: { status: "ACTIVE" | "REJECTED"; decidedById: string; decisionReason?: string },
  ): Promise<AccessRequest> {
    return prisma.accessRequest.update({
      where: { id },
      data: {
        status: data.status,
        decidedById: data.decidedById,
        decisionReason: data.decisionReason,
        decidedAt: new Date(),
      },
    });
  }
}

export const accessRequestRepository = new AccessRequestRepository();
