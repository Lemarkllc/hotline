import type { Prisma, VacationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma.js";
import { nextSequence } from "@/utils/sequence.js";

export const VACATION_DETAIL_INCLUDE = {
  user: true,
  decidedBy: true,
} satisfies Prisma.VacationRequestInclude;

export type VacationRequestWithUsers = Prisma.VacationRequestGetPayload<{ include: typeof VACATION_DETAIL_INCLUDE }>;

/** «Отпуска» — по образцу AccessRequestRepository (ближайший в кодовой базе аналог
 * "заявка сотрудника → HRD решает"), но userId НЕ unique: у сотрудника может быть
 * много заявок за разное время, в отличие от одной активной заявки на доступ. */
export class VacationRequestRepository {
  /** Год фиксируется на момент создания — то же пространство нумерации (utils/sequence.ts),
   * что и у Appeal/EmailLead, но свой ключ "VACATION:{год}" и префикс "ОТП-" (не "О-" —
   * визуально не путается с нулём). */
  async create(data: {
    userId: string;
    telegramId: bigint;
    dateFrom: Date;
    dateTo: Date;
    comment?: string;
    paid: boolean;
  }): Promise<VacationRequestWithUsers> {
    const year = new Date().getUTCFullYear();
    return prisma.$transaction(async (tx) => {
      const sequence = await nextSequence(`VACATION:${year}`);
      const publicNumber = `ОТП-${year}-${String(sequence).padStart(5, "0")}`;
      return tx.vacationRequest.create({
        data: {
          publicNumber,
          userId: data.userId,
          telegramId: data.telegramId,
          dateFrom: data.dateFrom,
          dateTo: data.dateTo,
          comment: data.comment,
          paid: data.paid,
        },
        include: VACATION_DETAIL_INCLUDE,
      });
    });
  }

  /** Сумма дней ОДОБРЕННОГО оплачиваемого отпуска, приходящегося на период строго
   * после asOfDate — используется формулой остатка (utils/vacationBalance.ts).
   * Считается по количеству дней в каждой заявке (dateTo-dateFrom+1 включительно),
   * не по количеству самих заявок. */
  async sumApprovedPaidDaysSince(userId: string, asOfDate: Date): Promise<number> {
    const rows = await prisma.vacationRequest.findMany({
      where: { userId, status: "APPROVED", paid: true, dateFrom: { gt: asOfDate } },
      select: { dateFrom: true, dateTo: true },
    });
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    return rows.reduce((sum, r) => sum + Math.round((r.dateTo.getTime() - r.dateFrom.getTime()) / MS_PER_DAY) + 1, 0);
  }

  findById(id: string): Promise<VacationRequestWithUsers | null> {
    return prisma.vacationRequest.findUnique({ where: { id }, include: VACATION_DETAIL_INCLUDE });
  }

  listByUserId(userId: string): Promise<VacationRequestWithUsers[]> {
    return prisma.vacationRequest.findMany({
      where: { userId },
      include: VACATION_DETAIL_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  listAll(status?: VacationStatus): Promise<VacationRequestWithUsers[]> {
    return prisma.vacationRequest.findMany({
      where: status ? { status } : undefined,
      include: VACATION_DETAIL_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  decide(
    id: string,
    data: { status: "APPROVED" | "REJECTED"; decidedById: string; decisionReason?: string },
  ): Promise<VacationRequestWithUsers> {
    return prisma.vacationRequest.update({
      where: { id },
      data: {
        status: data.status,
        decidedById: data.decidedById,
        decisionReason: data.decisionReason,
        decidedAt: new Date(),
      },
      include: VACATION_DETAIL_INCLUDE,
    });
  }
}

export const vacationRequestRepository = new VacationRequestRepository();
