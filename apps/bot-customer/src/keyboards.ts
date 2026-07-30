import { InlineKeyboard } from "grammy";
import { CUSTOMER_APPEAL_TYPE_LABELS, CUSTOMER_APPEAL_TYPES } from "@hotline/shared";

export function typeKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const type of CUSTOMER_APPEAL_TYPES) {
    kb.text(CUSTOMER_APPEAL_TYPE_LABELS[type], `type:${type}`).row();
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
  "**Открыто** — сотрудники компании смогут видеть ваши данные.\n" +
  "**Конфиденциально** — ваши данные скрыты, обращение видит только ограниченный круг ответственных.";

export function skipKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("Пропустить и написать своими словами", "skip_all");
}

export function previewKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Отправить", "submit")
    .row()
    .text("Изменить текст", "edit_text")
    .row()
    .text("Изменить режим", "edit_mode")
    .row()
    .text("Отменить", "cancel");
}

/** Первый из двух NPS-вопросов (Фаза 7, PLAN.md §6) — второй начинается сразу после
 * выбора здесь (см. npsReturnKeyboard), сам выбор кодируется в callback data второй
 * клавиатуры, не в session (стейтлесс — проще, чем заводить поле сессии на два клика). */
export function npsRecommendKeyboard(appealId: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (let score = 1; score <= 5; score += 1) {
    kb.text(String(score), `nps_recommend:${appealId}:${score}`);
  }
  kb.row().text("Оценю позже", `nps_later:${appealId}`);
  return kb;
}

export function npsReturnKeyboard(appealId: string, recommendScore: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (let score = 1; score <= 5; score += 1) {
    kb.text(String(score), `nps_return:${appealId}:${recommendScore}:${score}`);
  }
  return kb;
}

export const MAIN_MENU_KEYBOARD = new InlineKeyboard()
  .text("Оставить обращение", "menu:new")
  .row()
  .text("Мои обращения", "menu:my")
  .row()
  .text("О конфиденциальности", "menu:privacy");
