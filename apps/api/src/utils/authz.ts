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
 * Может ли viewer увидеть автора обращения в ОБЫЧНОМ ответе (список/карточка) —
 * это САМЫЙ критический инвариант проекта, поэтому вынесен в чистую функцию без
 * зависимости от Prisma-типов, чтобы её было легко покрыть unit-тестами
 * (см. tests/authz.test.ts) для всех комбинаций режим × permission × назначение.
 *
 * CONFIDENTIAL: НИКОГДА (даже у appeal.read_author) — раскрытие только через
 * отдельный шаг подтверждения паролем, см. canRevealAuthor() и
 * appealService.revealAuthor(). Это намеренное усиление инварианта (было: HRD видел
 * автора сразу), а не ослабление — базовый ответ больше не содержит личность автора
 * ни при каких permission, только явный дополнительный запрос с логированием.
 * OPEN: read_all, либо read_assigned + реально назначен на это обращение.
 */
export function canSeeAuthor(
  appeal: { channel: Channel; mode: "OPEN" | "CONFIDENTIAL" },
  user: AuthenticatedUser,
  isAssignedToViewer: boolean,
): boolean {
  if (appeal.mode === "CONFIDENTIAL") return false;
  if (hasChannelPermission(user, "appeal.read_all", appeal.channel)) return true;
  return hasChannelPermission(user, "appeal.read_assigned", appeal.channel) && isAssignedToViewer;
}

/**
 * Может ли viewer РАСКРЫТЬ автора конфиденциального обращения через отдельный
 * эндпоинт (повторный ввод пароля + запись в audit_log, FR-CONF-005/FR-PRV-005).
 * Ровно appeal.read_author — по умолчанию только HRD; Администратору выдан явно
 * (см. packages/shared/permissions.ts) как второе доверенное лицо для работы с ПДн,
 * что осознанно отступает от буквы SRS §4.3 ("только через защищённый журнал"),
 * но не от духа: раскрытие всё равно журналируется и требует пароля, "автоматического"
 * доступа как такового нет.
 */
export function canRevealAuthor(
  appeal: { channel: Channel; mode: "OPEN" | "CONFIDENTIAL" },
  user: AuthenticatedUser,
): boolean {
  return appeal.mode === "CONFIDENTIAL" && hasChannelPermission(user, "appeal.read_author", appeal.channel);
}
