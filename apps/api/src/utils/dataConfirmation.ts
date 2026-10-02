/** «Подтвердить данные» (userService.requestDataConfirmation): срок ответа сотрудника
 * и момент напоминания — решение пользователя 2026-10-02: 2 дня на подтверждение,
 * напоминание за 5 часов до конца, после — блокировка. */
export const DATA_CONFIRMATION_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
export const DATA_CONFIRMATION_REMINDER_BEFORE_MS = 5 * 60 * 60 * 1000;

export type DataConfirmationAction = "none" | "remind" | "block" | "clear";

/** Что сделать с проверкой на очередном тике (userService.processDataConfirmationDeadlines).
 * Истёк срок — только блокировка, без запоздалого напоминания; не-активный сотрудник
 * (уже заблокирован вручную, архив) — просто снять срок. */
export function decideDataConfirmation(
  user: { status: string; dataConfirmationDeadline: Date | null; dataConfirmationRemindedAt: Date | null },
  now: Date,
): DataConfirmationAction {
  const deadline = user.dataConfirmationDeadline;
  if (!deadline) return "none";
  if (user.status !== "ACTIVE") return "clear";
  if (now >= deadline) return "block";
  if (!user.dataConfirmationRemindedAt && deadline.getTime() - now.getTime() <= DATA_CONFIRMATION_REMINDER_BEFORE_MS) {
    return "remind";
  }
  return "none";
}
