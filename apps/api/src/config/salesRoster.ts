/**
 * Ростер отдела продаж для алгоритма авто-назначения лидов (leadAssignmentService.ts) —
 * реальные Bitrix24 ID сотрудников (выгрузка "Продажи - Sales", предоставлена
 * пользователем), захардкожены осознанно: имена/ID меняются редко, а матчинг по имени
 * (вместо ID) был бы хрупок к опечаткам/склонениям при ручном сопоставлении. Если
 * состав отдела изменится — правки только здесь, остальной код от количества/имён
 * не зависит (NEWCOMERS/OVERFLOW/REST — просто списки ключей).
 */
export const SALES_ROSTER = {
  ROMAN: { bitrixId: "87", fullName: "Роман Гурьев" },
  MILA: { bitrixId: "137", fullName: "Мила Яхина" },
  ANASTASIA: { bitrixId: "17", fullName: "Анастасия Архипова" },
  PAVEL: { bitrixId: "83", fullName: "Павел Лякишев" },
  TATIANA: { bitrixId: "85", fullName: "Татьяна Пономарёва" },
  ALEXANDER: { bitrixId: "89", fullName: "Александр Шевчук" },
} as const;

export type SalesRosterKey = keyof typeof SALES_ROSTER;

export const SALES_ROSTER_KEYS = Object.keys(SALES_ROSTER) as SalesRosterKey[];

/** Новички — round-robin по нагрузке, высший приоритет после именного назначения. */
export const NEWCOMERS: SalesRosterKey[] = ["ROMAN", "MILA"];

/** Переполнение — тот же порог, что у новичков, но ниже их по приоритету. */
export const OVERFLOW: SalesRosterKey = "ANASTASIA";

/** Опытные — случайный выбор, если и переполнение занято; сегодня 3 человека, но
 * код (leadAssignmentService.ts) не завязан на конкретное количество. */
export const REST: SalesRosterKey[] = ["PAVEL", "TATIANA", "ALEXANDER"];

/** Порог "Не обработан" (Bitrix STATUS_ID="NEW") для новичков и переполнения. */
export const NEW_LEAD_THRESHOLD = 10;
