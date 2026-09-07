import { InlineKeyboard } from "grammy";
import { EMPLOYEE_APPEAL_TYPE_LABELS, EMPLOYEE_APPEAL_TYPES } from "@hotline/shared";

const TYPE_DESCRIPTIONS: Record<string, string> = {
  COMPLAINT: "сообщить о проблеме или несправедливой ситуации",
  SUGGESTION: "предложить улучшение",
  VIOLATION: "сообщить о несоблюдении правил",
  QUESTION: "получить официальный ответ",
  GRATITUDE: "отметить хорошую работу",
  RESIGNATION: "подать заявление на увольнение",
};

export function typeKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const type of EMPLOYEE_APPEAL_TYPES) {
    kb.text(`${EMPLOYEE_APPEAL_TYPE_LABELS[type]} — ${TYPE_DESCRIPTIONS[type]}`, `type:${type}`).row();
  }
  kb.text("Отменить", "cancel");
  return kb;
}

export function modeKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Открыто", "mode:OPEN")
    .row()
    .text("Конфиденциально", "mode:CONFIDENTIAL")
    .row()
    .text("Отменить", "cancel");
}

export const MODE_EXPLANATION =
  "**Открыто** — HRD и менеджеры смогут видеть ваши данные.\n" +
  "**Конфиденциально** — ваши данные не будут видны ответственным сотрудникам.";

export function skipAllKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("Пропустить и написать своими словами", "skip_all");
}

export const MAX_ATTACHMENTS = 10;

/** Telegram-бот не может сам открыть галерею на телефоне пользователя — фото/видео
 * прикладываются обычной отправкой файла в чат (через скрепку в интерфейсе Telegram).
 * Поэтому кнопки "Добавить ещё" тут нет: она не выполняет никакого действия и только
 * создаёт впечатление, что бот завис, когда пользователь на неё нажимает. */
export function attachmentsKeyboard(count: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (count > 0) kb.text("Удалить последний", "attach_remove_last").row();
  kb.text("Перейти дальше", "attach_done");
  return kb;
}

/** hideModeEdit — для заявления на увольнение режим всегда OPEN и не редактируется
 * (см. newAppeal.ts, isResignation), поэтому кнопка "Изменить режим" не показывается. */
export function previewKeyboard(hideModeEdit = false): InlineKeyboard {
  const kb = new InlineKeyboard().text("Отправить", "submit").row().text("Изменить текст", "edit_text").row();
  if (!hideModeEdit) {
    kb.text("Изменить режим", "edit_mode").row();
  }
  return kb.text("Изменить вложения", "edit_attachments").row().text("Отменить", "cancel");
}

export function ratingKeyboard(appealId: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (let score = 1; score <= 5; score += 1) {
    kb.text(String(score), `rate:${appealId}:${score}`);
  }
  kb.row().text("Оценить позже", `rate_later:${appealId}`);
  return kb;
}

export function accessRequestKeyboard(requestId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("Подтвердить", `accreq_approve:${requestId}`)
    .text("Отклонить", `accreq_reject:${requestId}`);
}

/** Раздел «Отпуска» (PLAN.md §10) — выбор из трёх кнопок, точка входа для команды
 * /absence в системном ☰-меню Telegram (index.ts, setMyCommands). Без inline-кнопки
 * до этого раздела нельзя было добраться иначе, кроме как случайно наткнувшись на
 * него после отмены "Создать обращение" — там пересылается общее меню целиком
 * (найдено пользователем вживую). ☰-меню — не то же самое, что MAIN_MENU_KEYBOARD
 * ниже: это отдельный список Telegram-команд, вводимых вручную, а не inline-кнопки. */
export function hrMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Отпуск", "menu:vacation")
    .row()
    .text("Отсутствие", "menu:absence")
    .row()
    .text("Командировка", "menu:business_trip");
}

/** Раздел «Отпуска» (PLAN.md §10) — три отдельные кнопки вместо одной "Отпуск",
 * единственное число — называют действие, не список (в отличие от вкладок в вебе). */
export const MAIN_MENU_KEYBOARD = new InlineKeyboard()
  .text("Создать обращение", "menu:new")
  .row()
  .text("Отпуск", "menu:vacation")
  .row()
  .text("Отсутствие", "menu:absence")
  .row()
  .text("Командировка", "menu:business_trip")
  .row()
  .text("Мои обращения", "menu:my")
  .row()
  .text("Как это работает", "menu:help")
  .row()
  .text("Конфиденциальность", "menu:privacy");

/** «Отпуска» — отдельная сущность (не Appeal), согласовывает только HRD на вебе,
 * поэтому у превью нет "Изменить режим"/вложений — только тип оплаты/даты/комментарий. */
export function vacationPaidKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Оплачиваемый", "paid:true")
    .row()
    .text("За свой счёт", "paid:false")
    .row()
    .text("Отменить", "cancel");
}

/** showBalanceButton — только для paid=true: для "за свой счёт" баланс не проверяется
 * (решение пользователя, PLAN.md §10), кнопка была бы бессмысленной. */
export function vacationDateKeyboard(showBalanceButton: boolean): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (showBalanceButton) kb.text("Узнать количество дней отпуска", "check_balance").row();
  kb.text("Отменить", "cancel");
  return kb;
}

export function vacationCommentKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("Пропустить", "skip_comment").row().text("Отменить", "cancel");
}

export function vacationPreviewKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Отправить", "submit")
    .row()
    .text("Изменить тип оплаты", "edit_paid")
    .row()
    .text("Изменить даты", "edit_dates")
    .row()
    .text("Изменить комментарий", "edit_comment")
    .row()
    .text("Отменить", "cancel");
}

/** «Отсутствие» (было "Отпроситься"/TIME_OFF внутри Appeal, PLAN.md §10) —
 * структурированный сбор данных (дата/время), а не наводящие вопросы. Режим
 * всегда OPEN (не спрашивается вообще — тот же принцип, что у RESIGNATION в
 * newAppeal.ts), поэтому здесь нет клавиатуры выбора режима. */
export function absenceTimeKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("Весь день", "full_day").row().text("Отменить", "cancel");
}

export function absenceReasonKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("Пропустить", "skip_reason").row().text("Отменить", "cancel");
}

export function absencePreviewKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Отправить", "submit")
    .row()
    .text("Изменить дату", "edit_date")
    .row()
    .text("Изменить время", "edit_time")
    .row()
    .text("Изменить причину", "edit_reason")
    .row()
    .text("Отменить", "cancel");
}

/** «Командировка» (PLAN.md §10) — цель обязательна, транспорт из фиксированного
 * списка (уточнение текстом только при "Другое" — см. conversations/businessTrip.ts). */
export function businessTripTransportKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Автомобиль", "transport:CAR")
    .row()
    .text("Самолёт", "transport:PLANE")
    .row()
    .text("Поезд", "transport:TRAIN")
    .row()
    .text("Другое", "transport:OTHER")
    .row()
    .text("Отменить", "cancel");
}

export function businessTripHotelKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("Да", "hotel:true").text("Нет", "hotel:false").row().text("Отменить", "cancel");
}

export function businessTripPreviewKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Отправить", "submit")
    .row()
    .text("Изменить даты", "edit_dates")
    .row()
    .text("Изменить цель", "edit_purpose")
    .row()
    .text("Изменить транспорт", "edit_transport")
    .row()
    .text("Изменить отель", "edit_hotel")
    .row()
    .text("Отменить", "cancel");
}
