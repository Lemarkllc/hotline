/**
 * Ростер отдела продаж для алгоритма авто-назначения лидов (leadAssignmentService.ts) —
 * реальные Bitrix24 ID сотрудников (выгрузка "Продажи - Sales", предоставлена
 * пользователем), захардкожены осознанно: имена/ID меняются редко, а матчинг по имени
 * (вместо ID) был бы хрупок к опечаткам/склонениям при ручном сопоставлении. Если
 * состав отдела изменится — правки только здесь, остальной код от количества/имён
 * не зависит (NEWCOMERS/REST — просто списки ключей).
 */
export const SALES_ROSTER = {
  ROMAN: { bitrixId: "87", fullName: "Роман Гурьев" },
  ANASTASIA: { bitrixId: "17", fullName: "Анастасия Архипова" },
  PAVEL: { bitrixId: "83", fullName: "Павел Лякишев" },
  TATIANA: { bitrixId: "85", fullName: "Татьяна Пономарёва" },
  ALEXANDER: { bitrixId: "89", fullName: "Александр Шевчук" },
} as const;

export type SalesRosterKey = keyof typeof SALES_ROSTER;

export const SALES_ROSTER_KEYS = Object.keys(SALES_ROSTER) as SalesRosterKey[];

/** Приоритетная пара — самобалансировка по нагрузке, высший приоритет после
 * именного назначения (решение пользователя, 2026-09-17: Мила уволилась, Архипова
 * заняла её место в этом тире, а не отдельный "переполнение"-тир — тот стал бы
 * пустым сам по себе, раз в нём никого не осталось). Порядок ЗНАЧИМ: при равной
 * нагрузке (или единственной прошедшей порог) побеждает первый в массиве — тем же
 * механизмом, что и раньше, но теперь тай-брейк должен быть за Архиповой, поэтому
 * она первая (см. leadAssignmentService.pickAssignee).
 */
export const NEWCOMERS: SalesRosterKey[] = ["ANASTASIA", "ROMAN"];

/** Опытные — случайный выбор, если и приоритетная пара занята; сегодня 3 человека,
 * но код (leadAssignmentService.ts) не завязан на конкретное количество. */
export const REST: SalesRosterKey[] = ["PAVEL", "TATIANA", "ALEXANDER"];

/** Порог "Не обработан" (Bitrix STATUS_ID="NEW") для новичков и переполнения. */
export const NEW_LEAD_THRESHOLD = 10;
