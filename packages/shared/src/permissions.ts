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
  // «Заявки» (email-лиды с sales@) — намеренно НЕ канало-скоуплен: EmailLead не
  // имеет поля channel вообще, это отдельная от Appeal подсистема (PLAN.md
  // "«Заявки» — email-лиды..."). Проверяется как user.permissions.includes(...)
  // напрямую, а не через hasChannelPermission().
  "lead.manage",
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
  // appeal.read_all добавлен ради ОБТ (опытной боевой эксплуатации) — SRS §4.5 матрица
  // допускает это явно ("Видеть все | Администратор | По праву").
  // appeal.read_author добавлен по прямому решению владельца продукта: Администратор —
  // второе доверенное лицо (наряду с HRD) для работы с персональными данными. Это
  // осознанное отступление от буквы SRS §4.3, но не от духа — раскрытие автора
  // CONFIDENTIAL-обращения всё равно требует отдельного шага (повторный пароль) и
  // журналируется, см. canRevealAuthor()/appealService.revealAuthor() в apps/api.
  ADMINISTRATOR: ["user.manage", "audit.read", "report.read", "appeal.read_all", "appeal.read_author"],
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
  // Фаза 7 (PLAN.md §6, решено 30.07.2026): «Продажи» ведёт канал CUSTOMER целиком —
  // ровно набор HRD, но применяется только там, где есть user_channel_access(CUSTOMER)
  // (по умолчанию не выдаётся никому, включая эту роль — грант всегда явный, см. допущение
  // №8 раздела 9 PLAN.md). Не user.manage/audit.read — это не HRD-эквивалент по
  // администрированию, только по работе с обращениями своего канала.
  SALES: [
    "appeal.read_all",
    "appeal.read_assigned",
    "appeal.read_author",
    "appeal.assign",
    "appeal.close",
    "report.read",
    "report.export",
    // «Заявки» (email-лиды) — стоп-лист и передача в CRM доступны всей роли SALES,
    // без отдельного тира прав для РОП (стартовое решение, PLAN.md).
    "lead.manage",
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
