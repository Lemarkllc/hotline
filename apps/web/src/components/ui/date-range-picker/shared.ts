import { useState } from "react";

/** Порт логики выбора диапазона из design_handoff_mobile_pwa/Data picker/Desktop Date
 * Range Picker.dc.html — общая для DesktopDateRangePicker и MobileDateRangePicker
 * чистая логика (без JSX): построение сетки месяца, пресеты, reducer выбора диапазона.
 * Дата-математика — локальное время (getFullYear/getMonth/getDate), НЕ toISOString():
 * иначе календарь может подсветить не тот день как "сегодня" вблизи полуночи в
 * не-UTC часовых поясах пользователя. */

export const MONTH_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

export const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toKey(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

export function fmtShort(key: string): string {
  const [, mo, da] = key.split("-");
  return `${da}.${mo}`;
}

export interface CalendarDay {
  key: string;
  label: number | null;
  isEdge: boolean;
  inRange: boolean;
}

/** Понедельник — начало недели ((getDay()+6)%7), пустые ячейки-заглушки перед 1-м
 * числом месяца. Порт buildMonthDays из прототипа (строки 197-216). */
export function buildMonthDays(year: number, month: number, rangeStart: string | null, rangeEnd: string | null): CalendarDay[] {
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: CalendarDay[] = [];
  for (let i = 0; i < firstDow; i++) {
    days.push({ key: `blank-${i}`, label: null, isEdge: false, inRange: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const key = toKey(year, month, d);
    const inRange = Boolean(rangeStart && rangeEnd && key >= rangeStart && key <= rangeEnd);
    const isEdge = key === rangeStart || key === rangeEnd;
    days.push({ key, label: d, isEdge, inRange });
  }
  return days;
}

export interface PresetDef {
  id: string;
  label: string;
  start: string | null;
  end: string | null;
}

/** "Свой период" (desktop-only) — start/end оба null, чисто визуальная подсказка
 * "выбирайте вручную" (см. прототип: select только подсвечивает activePreset,
 * дат не трогает). */
export function buildPresets(kind: "desktop" | "mobile"): PresetDef[] {
  const today = new Date();
  const iso = (d: Date) => toKey(d.getFullYear(), d.getMonth(), d.getDate());
  const daysAgo = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return iso(d);
  };
  const monthStart = (offset: number) => iso(new Date(today.getFullYear(), today.getMonth() + offset, 1));
  const monthEnd = (offset: number) => iso(new Date(today.getFullYear(), today.getMonth() + offset + 1, 0));

  const presets: PresetDef[] = [
    { id: "today", label: "Сегодня", start: iso(today), end: iso(today) },
    { id: "7d", label: kind === "desktop" ? "Последние 7 дней" : "7 дней", start: daysAgo(6), end: iso(today) },
    { id: "30d", label: kind === "desktop" ? "Последние 30 дней" : "30 дней", start: daysAgo(29), end: iso(today) },
    { id: "thisMonth", label: "Этот месяц", start: monthStart(0), end: monthEnd(0) },
  ];
  if (kind === "desktop") {
    presets.push({ id: "lastMonth", label: "Прошлый месяц", start: monthStart(-1), end: monthEnd(-1) });
    presets.push({ id: "custom", label: "Свой период", start: null, end: null });
  }
  return presets;
}

export interface DateRangePickerProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  resetRange: { from: string; to: string };
}

/** Reducer выбора диапазона — 1:1 порт selectDay/applyPreset/clearRange из прототипа.
 * onChange зовётся сразу при завершении диапазона (второй клик) или пресете/сбросе —
 * без отдельного "черновика", "Применить" в компонентах — чистое закрытие поповера/
 * шторки, не коммит (см. прототип: applyPreset/selectDay уже мутируют то же состояние,
 * что рендерит триггер). draftStart/draftEnd — промежуточное состояние на время выбора
 * (второй клик ещё не сделан) — держим локально, а не в контролируемых from/to, потому
 * что API этого компонента требует непустой диапазон всегда (в отличие от прототипа,
 * где диапазон может быть не выбран вовсе). */
export function useDateRangeSelection({ from, to, onChange }: Pick<DateRangePickerProps, "from" | "to" | "onChange">) {
  const [draftStart, setDraftStart] = useState<string>(from);
  const [draftEnd, setDraftEnd] = useState<string | null>(to);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  /** Зовётся при каждом открытии поповера/шторки — сбрасывает локальный черновик
   * к последнему применённому значению. Без этого незавершённый выбор (только start,
   * без end), брошенный кликом снаружи/Escape, "утекал" бы в следующее открытие. */
  function resetDraft() {
    setDraftStart(from);
    setDraftEnd(to);
    setActivePreset(null);
  }

  function selectDay(key: string) {
    setActivePreset(null);
    if (draftEnd) {
      setDraftStart(key);
      setDraftEnd(null);
      return;
    }
    if (key < draftStart) {
      setDraftStart(key);
      setDraftEnd(null);
      return;
    }
    setDraftEnd(key);
    onChange(draftStart, key);
  }

  function applyPreset(id: string, start: string | null, end: string | null) {
    setActivePreset(id);
    if (start && end) {
      setDraftStart(start);
      setDraftEnd(end);
      onChange(start, end);
    }
  }

  function reset(resetFrom: string, resetTo: string) {
    setDraftStart(resetFrom);
    setDraftEnd(resetTo);
    setActivePreset(null);
    onChange(resetFrom, resetTo);
  }

  return { draftStart, draftEnd, activePreset, selectDay, applyPreset, reset, resetDraft };
}
