import type {
  Appeal,
  AppealMode,
  AppealStatus,
  Channel,
  CommentVisibility,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma.js";
import { formatPublicNumber, sequenceKey } from "@/utils/appealNumber.js";

export const APPEAL_DETAIL_INCLUDE = {
  author: true,
  externalContact: true,
  epic: true,
  assignments: { where: { unassignedAt: null }, include: { user: true } },
  attachments: { where: { deletedAt: null } },
  comments: { where: { deletedAt: null }, orderBy: { createdAt: "asc" as const }, include: { author: true } },
  messages: { orderBy: { createdAt: "asc" as const }, include: { author: true } },
  statusHistory: { orderBy: { createdAt: "asc" as const } },
  rating: true,
} satisfies Prisma.AppealInclude;

export type AppealWithDetails = Prisma.AppealGetPayload<{ include: typeof APPEAL_DETAIL_INCLUDE }>;

export interface AppealListFilters {
  channel: Channel;
  status?: AppealStatus;
  /** "Открытые" для автора в боте — любой статус, кроме CLOSED. Отдельно от status,
   * т.к. это не конкретное значение, а "все, кроме одного" (взаимоисключимо с status). */
  excludeStatus?: AppealStatus;
  type?: string;
  epicId?: string;
  mode?: AppealMode;
  assigneeId?: string;
  authorUserId?: string;
  /** Канал CUSTOMER — эквивалент authorUserId для ExternalContact (Фаза 7, PLAN.md §6). */
  externalContactId?: string;
  createdFrom?: Date;
  createdTo?: Date;
  search?: string;
  ratingScore?: number;
  /** Открыто/На проверке + без активного назначения — конкретное подмножество,
   * а не синоним "весь список" (см. обсуждение семантики бэклога с пользователем). */
  backlogOnly?: boolean;
  /** Оценка 1-2 (FR-EVL-005 порог "низкая оценка"), а не точное совпадение как ratingScore. */
  lowRatingOnly?: boolean;
  page: number;
  pageSize: number;
}

export class AppealRepository {
  /** Атомарный инкремент счётчика — Prisma-upsert компилируется в нативный
   * `INSERT ... ON CONFLICT` для PostgreSQL, что делает его race-safe. */
  private async nextSequence(channel: Channel, year: number): Promise<number> {
    const key = sequenceKey(channel, year);
    const seq = await prisma.numberSequence.upsert({
      where: { key },
      update: { value: { increment: 1 } },
      create: { key, value: 1 },
    });
    return seq.value;
  }

  async create(data: {
    channel: Channel;
    type: string;
    mode: AppealMode;
    originalText: string;
    authorUserId?: string;
    externalContactId?: string;
    attachmentIds?: string[];
  }): Promise<Appeal> {
    const year = new Date().getUTCFullYear();
    return prisma.$transaction(async (tx) => {
      const sequence = await this.nextSequence(data.channel, year);
      const publicNumber = formatPublicNumber(data.channel, year, sequence);

      const appeal = await tx.appeal.create({
        data: {
          channel: data.channel,
          type: data.type,
          mode: data.mode,
          originalText: data.originalText,
          authorUserId: data.authorUserId,
          externalContactId: data.externalContactId,
          publicNumber,
          status: "OPEN",
        },
      });

      if (data.attachmentIds?.length) {
        // appealId: null + uploadedByUserId проверка — не даём "перехватить" чужой черновик
        await tx.appealAttachment.updateMany({
          where: {
            id: { in: data.attachmentIds },
            appealId: null,
            ...(data.authorUserId ? { uploadedByUserId: data.authorUserId } : {}),
          },
          data: { appealId: appeal.id, draftExpiresAt: null },
        });
      }

      await tx.appealStatusHistory.create({
        data: { appealId: appeal.id, fromStatus: null, toStatus: "OPEN" },
      });

      return appeal;
    });
  }

  findById(id: string): Promise<AppealWithDetails | null> {
    return prisma.appeal.findFirst({
      where: { id, deletedAt: null },
      include: APPEAL_DETAIL_INCLUDE,
    });
  }

  findByPublicNumber(publicNumber: string): Promise<AppealWithDetails | null> {
    return prisma.appeal.findFirst({
      where: { publicNumber, deletedAt: null },
      include: APPEAL_DETAIL_INCLUDE,
    });
  }

  async list(filters: AppealListFilters): Promise<{ items: AppealWithDetails[]; total: number }> {
    const where: Prisma.AppealWhereInput = {
      deletedAt: null,
      channel: filters.channel,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.excludeStatus ? { status: { not: filters.excludeStatus } } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.epicId ? { epicId: filters.epicId } : {}),
      ...(filters.mode ? { mode: filters.mode } : {}),
      ...(filters.authorUserId ? { authorUserId: filters.authorUserId } : {}),
      ...(filters.externalContactId ? { externalContactId: filters.externalContactId } : {}),
      ...(filters.assigneeId
        ? { assignments: { some: { userId: filters.assigneeId, unassignedAt: null } } }
        : {}),
      ...(filters.createdFrom || filters.createdTo
        ? {
            createdAt: {
              ...(filters.createdFrom ? { gte: filters.createdFrom } : {}),
              ...(filters.createdTo ? { lte: filters.createdTo } : {}),
            },
          }
        : {}),
      ...(filters.ratingScore ? { rating: { score: filters.ratingScore } } : {}),
      ...(filters.lowRatingOnly ? { rating: { score: { lte: 2 } } } : {}),
      ...(filters.backlogOnly
        ? { status: { in: ["OPEN", "UNDER_REVIEW"] }, assignments: { none: { unassignedAt: null } } }
        : {}),
      ...(filters.search
        ? {
            OR: [
              { publicNumber: { contains: filters.search, mode: "insensitive" } },
              { originalText: { contains: filters.search, mode: "insensitive" } },
              { workingEdit: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.appeal.findMany({
        where,
        include: APPEAL_DETAIL_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      prisma.appeal.count({ where }),
    ]);

    return { items, total };
  }

  async changeStatus(
    appealId: string,
    toStatus: AppealStatus,
    changedById: string | null,
    reason?: string,
  ): Promise<Appeal> {
    return prisma.$transaction(async (tx) => {
      const current = await tx.appeal.findUniqueOrThrow({ where: { id: appealId } });
      const updated = await tx.appeal.update({
        where: { id: appealId },
        data: {
          status: toStatus,
          closedAt: toStatus === "CLOSED" ? new Date() : null,
          reopenDeadlineAt:
            toStatus === "CLOSED"
              ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
              : current.reopenDeadlineAt,
        },
      });
      await tx.appealStatusHistory.create({
        data: { appealId, fromStatus: current.status, toStatus, changedById, reason },
      });
      return updated;
    });
  }

  setWorkingEdit(appealId: string, workingEdit: string): Promise<Appeal> {
    return prisma.appeal.update({ where: { id: appealId }, data: { workingEdit } });
  }

  setEpic(appealId: string, epicId: string | null): Promise<Appeal> {
    return prisma.appeal.update({ where: { id: appealId }, data: { epicId } });
  }

  async assign(appealId: string, userId: string, isPrimary = true): Promise<void> {
    await prisma.$transaction([
      prisma.appealAssignment.updateMany({
        where: { appealId, isPrimary: true, unassignedAt: null },
        data: { unassignedAt: new Date() },
      }),
      prisma.appealAssignment.create({
        data: { appealId, userId, isPrimary },
      }),
    ]);
  }

  async unassignAll(appealId: string): Promise<void> {
    await prisma.appealAssignment.updateMany({
      where: { appealId, unassignedAt: null },
      data: { unassignedAt: new Date() },
    });
  }

  addComment(data: {
    appealId: string;
    authorId: string;
    visibility: CommentVisibility;
    text: string;
    isFinalAnswer?: boolean;
  }) {
    return prisma.appealComment.create({ data });
  }

  addMessage(appealId: string, fromHrd: boolean, text: string, authorId?: string) {
    return prisma.appealMessage.create({ data: { appealId, fromHrd, text, authorId } });
  }

  /** Загрузка ДО создания обращения — черновик с TTL 24ч (FR-DRF-002/006). */
  addDraftAttachment(data: {
    uploadedByUserId: string;
    storageKey: string;
    mimeType: string;
    fileSize: number;
    kind: "PHOTO" | "VIDEO";
  }) {
    return prisma.appealAttachment.create({
      data: {
        ...data,
        appealId: null,
        draftExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      } as Prisma.AppealAttachmentUncheckedCreateInput,
    });
  }

  countDraftAttachments(uploadedByUserId: string): Promise<number> {
    return prisma.appealAttachment.count({
      where: { uploadedByUserId, appealId: null, deletedAt: null },
    });
  }

  countAttachments(appealId: string): Promise<number> {
    return prisma.appealAttachment.count({ where: { appealId, deletedAt: null } });
  }

  async deleteDraftAttachment(id: string, uploadedByUserId: string): Promise<boolean> {
    const result = await prisma.appealAttachment.deleteMany({
      where: { id, uploadedByUserId, appealId: null },
    });
    return result.count > 0;
  }

  /** Кандидаты на физическую очистку из object storage — вызывается периодической задачей. */
  findExpiredDraftAttachments(): Promise<{ id: string; storageKey: string }[]> {
    return prisma.appealAttachment.findMany({
      where: { appealId: null, draftExpiresAt: { lt: new Date() }, deletedAt: null },
      select: { id: true, storageKey: true },
    });
  }

  markAttachmentDeleted(id: string): Promise<unknown> {
    return prisma.appealAttachment.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  upsertRating(appealId: string, authorId: string, score: number, comment?: string) {
    return prisma.rating.upsert({
      where: { appealId },
      update: { score, comment },
      create: { appealId, authorId, score, comment },
    });
  }

  /** Канал CUSTOMER — два поля вместо score/comment (Фаза 7, PLAN.md §6, NPS-style). */
  upsertCustomerRating(
    appealId: string,
    externalContactId: string,
    wouldRecommendScore: number,
    wouldReturnScore: number,
  ) {
    return prisma.rating.upsert({
      where: { appealId },
      update: { wouldRecommendScore, wouldReturnScore },
      create: { appealId, externalContactId, wouldRecommendScore, wouldReturnScore },
    });
  }
}

export const appealRepository = new AppealRepository();
