import ExcelJS from "exceljs";
import type { Channel } from "@hotline/shared";
import { prisma } from "@/lib/prisma.js";
import type { AuthenticatedUser } from "@/types/index.js";
import { ForbiddenError } from "@/types/index.js";
import { hasChannelPermission } from "@/utils/authz.js";

interface TimingRow {
  id: string;
  createdAt: Date;
  first_review_at: Date | null;
  first_closed_at: Date | null;
}

function avgMinutes(dates: (number | null)[]): number | null {
  const valid = dates.filter((d): d is number => d !== null);
  if (!valid.length) return null;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

/** Метрики строго по определениям SRS §36 — формулы не додумывались, а переносились дословно. */
export class ReportService {
  async summary(user: AuthenticatedUser, channel: Channel, from: Date, to: Date) {
    if (!hasChannelPermission(user, "report.read", channel)) {
      throw new ForbiddenError("Недостаточно прав для просмотра отчётов");
    }

    const baseWhere = { channel, deletedAt: null, createdAt: { gte: from, lte: to } } as const;

    const [createdCount, byStatus, byType, byEpic, ratingAgg, lowRatingCount, ratedCount, reopenedCount, backlogCount] =
      await Promise.all([
        prisma.appeal.count({ where: baseWhere }),
        prisma.appeal.groupBy({ by: ["status"], where: baseWhere, _count: true }),
        prisma.appeal.groupBy({ by: ["type"], where: baseWhere, _count: true }),
        prisma.appeal.groupBy({ by: ["epicId"], where: baseWhere, _count: true }),
        prisma.rating.aggregate({
          where: { appeal: baseWhere },
          _avg: { score: true },
        }),
        prisma.rating.count({ where: { appeal: baseWhere, score: { lte: 2 } } }),
        prisma.rating.count({ where: { appeal: baseWhere } }),
        prisma.appealStatusHistory.count({
          where: { appeal: baseWhere, fromStatus: "CLOSED", toStatus: "IN_PROGRESS" },
        }),
        prisma.appeal.count({ where: { channel, deletedAt: null, createdAt: { lte: to }, status: { not: "CLOSED" } } }),
      ]);

    const timingRows = await prisma.$queryRaw<TimingRow[]>`
      SELECT
        a.id,
        a."createdAt",
        (SELECT MIN(h."createdAt") FROM appeal_status_history h WHERE h."appealId" = a.id AND h."toStatus" = 'UNDER_REVIEW') AS first_review_at,
        (SELECT MIN(h."createdAt") FROM appeal_status_history h WHERE h."appealId" = a.id AND h."toStatus" = 'CLOSED') AS first_closed_at
      FROM appeals a
      WHERE a.channel = ${channel}::"Channel" AND a."deletedAt" IS NULL
        AND a."createdAt" BETWEEN ${from} AND ${to}
    `;

    const avgFirstResponseMinutes = avgMinutes(
      timingRows.map((r) =>
        r.first_review_at ? (r.first_review_at.getTime() - r.createdAt.getTime()) / 60000 : null,
      ),
    );
    const avgClosingMinutes = avgMinutes(
      timingRows.map((r) =>
        r.first_closed_at ? (r.first_closed_at.getTime() - r.createdAt.getTime()) / 60000 : null,
      ),
    );

    return {
      period: { from, to },
      created: createdCount,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      byType: Object.fromEntries(byType.map((t) => [t.type, t._count])),
      byEpic: byEpic.map((e) => ({ epicId: e.epicId, count: e._count })),
      avgRating: ratingAgg._avg.score,
      lowRatingShare: ratedCount ? (lowRatingCount / ratedCount) * 100 : null,
      avgFirstResponseMinutes,
      avgClosingMinutes,
      reopenedCount,
      backlogAtPeriodEnd: backlogCount,
    };
  }

  async exportAppeals(
    user: AuthenticatedUser,
    channel: Channel,
    from: Date,
    to: Date,
    format: "csv" | "xlsx",
    includeAuthor: boolean,
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    if (!hasChannelPermission(user, "report.export", channel)) {
      throw new ForbiddenError("Недостаточно прав для экспорта");
    }
    if (includeAuthor && !hasChannelPermission(user, "appeal.read_author", channel)) {
      // PLAN.md §9 допущение №6: деанонимизация требует report.export + appeal.read_author одновременно
      throw new ForbiddenError("Экспорт с раскрытием автора требует отдельного права appeal.read_author");
    }

    const appeals = await prisma.appeal.findMany({
      where: { channel, deletedAt: null, createdAt: { gte: from, lte: to } },
      include: { author: true, epic: true, rating: true },
      orderBy: { createdAt: "asc" },
    });

    const rows = appeals.map((a) => ({
      publicNumber: a.publicNumber,
      createdAt: a.createdAt.toISOString(),
      type: a.type,
      mode: a.mode,
      status: a.status,
      epic: a.epic?.name ?? "",
      rating: a.rating?.score !== undefined ? String(a.rating?.score ?? "") : "",
      author: includeAuthor ? (a.mode === "CONFIDENTIAL" ? "" : (a.author?.fullName ?? "")) : "",
    }));

    const headers = ["publicNumber", "createdAt", "type", "mode", "status", "epic", "rating", ...(includeAuthor ? ["author"] : [])];

    if (format === "csv") {
      const csv = [
        headers.join(","),
        ...rows.map((r) => headers.map((h) => JSON.stringify(r[h as keyof typeof r] ?? "")).join(",")),
      ].join("\n");
      return { buffer: Buffer.from(csv, "utf-8"), contentType: "text/csv", filename: `report-${channel}.csv` };
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Обращения");
    sheet.columns = headers.map((key) => ({ header: key, key }));
    sheet.addRows(rows);
    const buffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(buffer),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: `report-${channel}.xlsx`,
    };
  }
}

export const reportService = new ReportService();
