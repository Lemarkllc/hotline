import type { Prisma, VacationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma.js";
import { nextSequence } from "@/utils/sequence.js";

export const ABSENCE_DETAIL_INCLUDE = {
  user: true,
  decidedBy: true,
} satisfies Prisma.AbsenceRequestInclude;

export type AbsenceRequestWithUsers = Prisma.AbsenceRequestGetPayload<{ include: typeof ABSENCE_DETAIL_INCLUDE }>;

/** «Отсутствие» (было TIME_OFF внутри Appeal, PLAN.md §10) — по образцу
 * VacationRequestRepository: userId НЕ unique, свой префикс/sequence-ключ номера. */
export class AbsenceRequestRepository {
  async create(data: {
    userId: string;
    telegramId: bigint;
    date: Date;
    fullDay: boolean;
    timeFrom?: string;
    timeTo?: string;
    reason?: string;
  }): Promise<AbsenceRequestWithUsers> {
    const year = new Date().getUTCFullYear();
    return prisma.$transaction(async (tx) => {
      const sequence = await nextSequence(`ABSENCE:${year}`);
      const publicNumber = `ОТС-${year}-${String(sequence).padStart(5, "0")}`;
      return tx.absenceRequest.create({
        data: {
          publicNumber,
          userId: data.userId,
          telegramId: data.telegramId,
          date: data.date,
          fullDay: data.fullDay,
          timeFrom: data.timeFrom,
          timeTo: data.timeTo,
          reason: data.reason,
        },
        include: ABSENCE_DETAIL_INCLUDE,
      });
    });
  }

  findById(id: string): Promise<AbsenceRequestWithUsers | null> {
    return prisma.absenceRequest.findUnique({ where: { id }, include: ABSENCE_DETAIL_INCLUDE });
  }

  listByUserId(userId: string): Promise<AbsenceRequestWithUsers[]> {
    return prisma.absenceRequest.findMany({
      where: { userId },
      include: ABSENCE_DETAIL_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  listAll(status?: VacationStatus): Promise<AbsenceRequestWithUsers[]> {
    return prisma.absenceRequest.findMany({
      where: status ? { status } : undefined,
      include: ABSENCE_DETAIL_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  decide(
    id: string,
    data: { status: "APPROVED" | "REJECTED"; decidedById: string; decisionReason?: string },
  ): Promise<AbsenceRequestWithUsers> {
    return prisma.absenceRequest.update({
      where: { id },
      data: {
        status: data.status,
        decidedById: data.decidedById,
        decisionReason: data.decisionReason,
        decidedAt: new Date(),
      },
      include: ABSENCE_DETAIL_INCLUDE,
    });
  }
}

export const absenceRequestRepository = new AbsenceRequestRepository();
