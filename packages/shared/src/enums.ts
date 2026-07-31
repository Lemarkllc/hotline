/**
 * Единый источник правды для строковых enum-значений, разделяемых между
 * api / bot-employee / bot-customer / web. Значения должны буквально совпадать
 * с enum-литералами в apps/api/prisma/schema.prisma — при изменении здесь
 * обновите схему и наоборот.
 */

export const CHANNELS = ["EMPLOYEE", "CUSTOMER"] as const;
export type Channel = (typeof CHANNELS)[number];

export const USER_STATUSES = [
  "PENDING",
  "ACTIVE",
  "REJECTED",
  "BLOCKED",
  "ARCHIVED",
] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const APPEAL_MODES = ["OPEN", "CONFIDENTIAL"] as const;
export type AppealMode = (typeof APPEAL_MODES)[number];

export const APPEAL_STATUSES = [
  "OPEN",
  "UNDER_REVIEW",
  "IN_PROGRESS",
  "CLOSED",
] as const;
export type AppealStatus = (typeof APPEAL_STATUSES)[number];

/** Разрешённые переходы статуса обращения (SRS §11). Проверяется на backend, не в UI. */
export const APPEAL_STATUS_TRANSITIONS: Record<AppealStatus, AppealStatus[]> = {
  OPEN: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["IN_PROGRESS", "CLOSED"],
  IN_PROGRESS: ["CLOSED"],
  CLOSED: ["IN_PROGRESS"], // повторное открытие
};

export const COMMENT_VISIBILITIES = ["INTERNAL", "PUBLIC"] as const;
export type CommentVisibility = (typeof COMMENT_VISIBILITIES)[number];

export const NOTIFICATION_CHANNELS = ["TELEGRAM", "WEB"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = ["PENDING", "SENT", "FAILED"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const ATTACHMENT_KINDS = ["PHOTO", "VIDEO"] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

// SALES — Фаза 7 (PLAN.md §6): ведёт канал CUSTOMER, не EMPLOYEE-роль как остальные три.
export const ROLE_NAMES = ["EMPLOYEE", "MANAGER", "ADMINISTRATOR", "HRD", "SALES"] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

/**
 * Типы обращений сотрудников — фиксированный список из SRS §6.1 для MVP.
 * Канал CUSTOMER получит свой набор типов отдельным справочником (Фаза 7, PLAN.md §6) —
 * поэтому поле `type` в Prisma хранится как String, а не Postgres enum, и валидируется
 * Zod-схемой, зависящей от канала (см. schemas.ts).
 */
export const EMPLOYEE_APPEAL_TYPES = [
  "COMPLAINT",
  "SUGGESTION",
  "VIOLATION",
  "QUESTION",
  "GRATITUDE",
  "RESIGNATION",
] as const;
export type EmployeeAppealType = (typeof EMPLOYEE_APPEAL_TYPES)[number];

export const EMPLOYEE_APPEAL_TYPE_LABELS: Record<EmployeeAppealType, string> = {
  COMPLAINT: "Жалоба",
  SUGGESTION: "Предложение",
  VIOLATION: "Нарушение",
  QUESTION: "Вопрос",
  GRATITUDE: "Благодарность",
  RESIGNATION: "Увольнение",
};

/** Исход закрытия заявления на увольнение (type="RESIGNATION") — не общий AppealStatus,
 * см. Appeal.resignationOutcome в schema.prisma и appealService.changeStatus. */
export const RESIGNATION_OUTCOMES = ["TERMINATED", "WITHDRAWN"] as const;
export type ResignationOutcome = (typeof RESIGNATION_OUTCOMES)[number];

export const RESIGNATION_OUTCOME_LABELS: Record<ResignationOutcome, string> = {
  TERMINATED: "Уволен(а)",
  WITHDRAWN: "Отозвано",
};

export const APPEAL_MODE_LABELS: Record<AppealMode, string> = {
  OPEN: "Открыто",
  CONFIDENTIAL: "Конфиденциально",
};

export const APPEAL_STATUS_LABELS: Record<AppealStatus, string> = {
  OPEN: "Открыто",
  UNDER_REVIEW: "На проверке",
  IN_PROGRESS: "В работе",
  CLOSED: "Закрыто",
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  PENDING: "Ожидает подтверждения",
  ACTIVE: "Активен",
  REJECTED: "Отклонён",
  BLOCKED: "Заблокирован",
  ARCHIVED: "В архиве",
};

/** Начальный справочник эпиков сотрудников (SRS §6.2). Канал EMPLOYEE, seed-данные. */
export const DEFAULT_EMPLOYEE_EPICS = [
  "Условия труда",
  "Производственные процессы",
  "Безопасность и охрана труда",
  "Руководство и коммуникация",
  "Персонал и HR",
  "Инфраструктура и бытовые условия",
  "Оборудование",
  "Качество",
  "Дисциплина",
  "Корпоративная культура",
  "Другое",
] as const;

/**
 * Типы обращений клиента (Фаза 7, PLAN.md §6, решено 30.07.2026) — сильно короче
 * пяти сотруднических: клиент либо жалуется, либо благодарит, третьего не нужно
 * ("много не нужно" — прямая формулировка заказчика). Appeal.type в Prisma — String,
 * а не enum, ровно ради такой независимой валидации по каналу (см. schema.prisma).
 */
export const CUSTOMER_APPEAL_TYPES = ["COMPLAINT", "GRATITUDE"] as const;
export type CustomerAppealType = (typeof CUSTOMER_APPEAL_TYPES)[number];

export const CUSTOMER_APPEAL_TYPE_LABELS: Record<CustomerAppealType, string> = {
  COMPLAINT: "Жалоба",
  GRATITUDE: "Благодарность",
};

/** Стартовый справочник эпиков канала CUSTOMER — правится потом через тот же UI
 * справочников, что и у EMPLOYEE (не продиктован явно, взят по аналогии, см. план). */
export const DEFAULT_CUSTOMER_EPICS = [
  "Качество товара/услуги",
  "Доставка",
  "Сервис и обслуживание",
  "Возврат/обмен",
  "Другое",
] as const;
