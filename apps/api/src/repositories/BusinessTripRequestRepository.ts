import type { BusinessTripTransport, Prisma, VacationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma.js";
import { nextSequence } from "@/utils/sequence.js";

export const BUSINESS_TRIP_DETAIL_INCLUDE = {
  user: true,
  decidedBy: true,
} satisfies Prisma.BusinessTripRequestInclude;

export type BusinessTripRequestWithUsers = Prisma.BusinessTripRequestGetPayload<{
  include: typeof BUSINESS_TRIP_DETAIL_INCLUDE;
}>;

/** «Командировка» (PLAN.md §10) — по образцу VacationRequestRepository/AbsenceRequestRepository. */
export class BusinessTripRequestRepository {
  async create(data: {
    userId: string;
    telegramId: bigint;
    dateFrom: Date;
    dateTo: Date;
    purpose: string;
    transport: BusinessTripTransport;
    transportOther?: string;
    hotelNeeded: boolean;
  }): Promise<BusinessTripRequestWithUsers> {
    const year = new Date().getUTCFullYear();
    return prisma.$transaction(async (tx) => {
      const sequence = await nextSequence(`BUSINESS_TRIP:${year}`);
      const publicNumber = `КМД-${year}-${String(sequence).padStart(5, "0")}`;
      return tx.businessTripRequest.create({
        data: {
          publicNumber,
          userId: data.userId,
          telegramId: data.telegramId,
          dateFrom: data.dateFrom,
          dateTo: data.dateTo,
          purpose: data.purpose,
          transport: data.transport,
          transportOther: data.transportOther,
          hotelNeeded: data.hotelNeeded,
        },
        include: BUSINESS_TRIP_DETAIL_INCLUDE,
      });
    });
  }

  findById(id: string): Promise<BusinessTripRequestWithUsers | null> {
    return prisma.businessTripRequest.findUnique({ where: { id }, include: BUSINESS_TRIP_DETAIL_INCLUDE });
  }

  listByUserId(userId: string): Promise<BusinessTripRequestWithUsers[]> {
    return prisma.businessTripRequest.findMany({
      where: { userId },
      include: BUSINESS_TRIP_DETAIL_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  listAll(status?: VacationStatus): Promise<BusinessTripRequestWithUsers[]> {
    return prisma.businessTripRequest.findMany({
      where: status ? { status } : undefined,
      include: BUSINESS_TRIP_DETAIL_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  decide(
    id: string,
    data: { status: "APPROVED" | "REJECTED"; decidedById: string; decisionReason?: string },
  ): Promise<BusinessTripRequestWithUsers> {
    return prisma.businessTripRequest.update({
      where: { id },
      data: {
        status: data.status,
        decidedById: data.decidedById,
        decisionReason: data.decisionReason,
        decidedAt: new Date(),
      },
      include: BUSINESS_TRIP_DETAIL_INCLUDE,
    });
  }
}

export const businessTripRequestRepository = new BusinessTripRequestRepository();
