import type { RoleName } from "./enums.js";

/** Явный набор RBAC permission-строк (SRS §21). */
export const PERMISSIONS = [
  "appeal.read_all",
  "appeal.read_assigned",
  "appeal.read_author",
  "appeal.assign",
  "appeal.close",
  "report.read",
  "report.export",
  "user.manage",
  "audit.read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * Дефолтная матрица роль → permissions (SRS §4.5). Используется при сидировании БД.
 * Роль EMPLOYEE не получает ни одного permission из этого списка — доступ сотрудника
 * к собственным обращениям реализуется отдельной проверкой "я автор", а не RBAC-правом.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  EMPLOYEE: [],
  MANAGER: ["appeal.read_assigned", "report.read"],
  ADMINISTRATOR: ["user.manage", "audit.read", "report.read"],
  HRD: [
    "appeal.read_all",
    "appeal.read_assigned",
    "appeal.read_author",
    "appeal.assign",
    "appeal.close",
    "report.read",
    "report.export",
    "audit.read",
  ],
};

/**
 * Доступ к permission всегда дополнительно скоуплен по каналу через
 * user_channel_access(userId, channel) — см. PLAN.md §6. Эта функция сама по себе
 * ничего не проверяет, она лишь документирует инвариант для реализации в API:
 * permission из DEFAULT_ROLE_PERMISSIONS действует только в тех каналах,
 * на которые у пользователя есть явный грант UserChannelAccess.
 */
export const CHANNEL_SCOPED_PERMISSION_NOTE =
  "Permission действует только в каналах из UserChannelAccess пользователя.";
