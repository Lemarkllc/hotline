/**
 * Построение WHERE-условия для выборки "уведомлений, которые нужно доставить боту"
 * (NotificationRepository.listPending) — вынесено в чистую функцию специально ради
 * мутационных тестов: сам запрос к Prisma протестировать мутациями нельзя без
 * реальной БД (в проекте пока только unit-тесты, см. CLAUDE.md), а вот форму
 * объекта — можно и нужно, именно тут был найден и допущен критический баг.
 *
 * Инцидент (07.09.2026, прод): фильтр по протоколу доставки (NotificationChannel:
 * TELEGRAM/WEB) применялся не в этом условии, а в JS уже ПОСЛЕ take(limit) в
 * repository-методе. WEB-уведомления (колокольчик на веб-панели, остаются PENDING
 * до прочтения в UI — то есть накапливаются без ограничения) вытеснили ВСЕ
 * Telegram-уведомления из выборки "N самых старых PENDING", когда их накопилось
 * больше лимита (в проде — свыше 1500 против 50). Результат — бот получал пустой
 * список и не отправлял НИЧЕГО целый месяц, включая критичные вещи вроде удаления
 * уволенных сотрудников из рабочих Telegram-групп (employee_terminated), без единой
 * ошибки в логах (запрос отрабатывал успешно, просто над пустым результатом).
 */

export type BotChannel = "EMPLOYEE" | "CUSTOMER";

export interface PendingNotificationsWhere {
  status: "PENDING";
  /** NotificationChannel (протокол доставки) — ВСЕГДА "TELEGRAM" для этой выборки,
   * никогда не WEB. Это ровно то условие, которого не хватало в проде. */
  channel: "TELEGRAM";
  userId?: { not: null };
  externalContactId?: { not: null };
}

/**
 * botChannel — EMPLOYEE/CUSTOMER (PLAN.md §6, не путать с NotificationChannel выше):
 * EMPLOYEE-бот доставляет уведомления с заполненным userId (автор — User),
 * CUSTOMER-бот — с заполненным externalContactId (автор — ExternalContact).
 * Ровно одно из двух заполнено на строку, никогда оба сразу и никогда ни одного.
 */
export function buildPendingNotificationsWhere(botChannel: BotChannel): PendingNotificationsWhere {
  return {
    status: "PENDING",
    channel: "TELEGRAM",
    ...(botChannel === "EMPLOYEE" ? { userId: { not: null } } : { externalContactId: { not: null } }),
  };
}
