import { InlineKeyboard } from "grammy";
import { EMPLOYEE_APPEAL_TYPE_LABELS, EMPLOYEE_APPEAL_TYPES } from "@hotline/shared";

const TYPE_DESCRIPTIONS: Record<string, string> = {
  COMPLAINT: "сообщить о проблеме или несправедливой ситуации",
  SUGGESTION: "предложить улучшение",
  VIOLATION: "сообщить о несоблюдении правил",
  QUESTION: "получить официальный ответ",
  GRATITUDE: "отметить хорошую работу",
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

export function attachmentsKeyboard(count: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (count < 10) kb.text("Добавить ещё", "attach_more").row();
  if (count > 0) kb.text("Удалить последний", "attach_remove_last").row();
  kb.text("Перейти дальше", "attach_done");
  return kb;
}

export function previewKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Отправить", "submit")
    .row()
    .text("Изменить текст", "edit_text")
    .row()
    .text("Изменить режим", "edit_mode")
    .row()
    .text("Изменить вложения", "edit_attachments")
    .row()
    .text("Отменить", "cancel");
}

export function ratingKeyboard(appealId: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (let score = 1; score <= 5; score += 1) {
    kb.text(String(score), `rate:${appealId}:${score}`);
  }
  kb.row().text("Оценить позже", `rate_later:${appealId}`);
  return kb;
}

export const MAIN_MENU_KEYBOARD = new InlineKeyboard()
  .text("Создать обращение", "menu:new")
  .row()
  .text("Мои обращения", "menu:my")
  .row()
  .text("Как это работает", "menu:help")
  .row()
  .text("Конфиденциальность", "menu:privacy");
