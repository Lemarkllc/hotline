import type { Channel, Permission } from "@hotline/shared";
import type { AuthenticatedUser } from "@/types/index.js";

/**
 * Критический инвариант проекта (PLAN.md §3, §6): permission действует ТОЛЬКО
 * в каналах, на которые у пользователя есть явный UserChannelAccess. HRD с
 * permission appeal.read_all, но без доступа к каналу CUSTOMER, не должен
 * увидеть ни одного клиентского обращения — и наоборот для сотрудников.
 */
export function hasChannelPermission(
  user: AuthenticatedUser,
  permission: Permission,
  channel: Channel,
): boolean {
  return user.permissions.includes(permission) && user.channels.includes(channel);
}

/**
 * Может ли viewer увидеть автора обращения (SRS §7, §4.5 матрица доступа) — это
 * САМЫЙ критический инвариант проекта, поэтому вынесен в чистую функцию без
 * зависимости от Prisma-типов, чтобы её было легко покрыть unit-тестами
 * (см. tests/authz.test.ts) для всех комбинаций режим × permission × назначение.
 *
 * CONFIDENTIAL: только appeal.read_author (де-факто HRD).
 * OPEN: read_all, либо read_assigned + реально назначен на это обращение.
 */
export function canSeeAuthor(
  appeal: { channel: Channel; mode: "OPEN" | "CONFIDENTIAL" },
  user: AuthenticatedUser,
  isAssignedToViewer: boolean,
): boolean {
  if (hasChannelPermission(user, "appeal.read_author", appeal.channel)) return true;
  if (appeal.mode === "CONFIDENTIAL") return false;
  if (hasChannelPermission(user, "appeal.read_all", appeal.channel)) return true;
  return hasChannelPermission(user, "appeal.read_assigned", appeal.channel) && isAssignedToViewer;
}
