import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { BottomSheet, BottomSheetContent, BottomSheetTitle, BottomSheetTrigger } from "@/components/ui/bottom-sheet";
import { cn } from "@/lib/utils";
import { buildMonthDays, buildPresets, fmtShort, MONTH_NAMES, useDateRangeSelection, WEEKDAYS, type DateRangePickerProps } from "./shared";

/** Мобильный/PWA дейт-рендж пикер — чип-триггер + bottom sheet (одномесячный
 * календарь, горизонтальный ряд из 4 пресетов), по design_handoff_mobile_pwa/Data
 * picker/Desktop Date Range Picker.dc.html (мобильная колонка прототипа). Переиспользует
 * @/components/ui/bottom-sheet — тот же паттерн, что и "назначить ответственного" в
 * AppealDetailMobile.tsx (контролируемое open/onOpenChange, своё состояние здесь). */
export function MobileDateRangePicker({ from, to, onChange, resetRange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => ({ year: Number(from.slice(0, 4)), month: Number(from.slice(5, 7)) - 1 }));
  const { draftStart, draftEnd, activePreset, selectDay, applyPreset, clearDraft, commit, resetDraft } = useDateRangeSelection({
    from,
    to,
    onChange,
  });

  const presets = useMemo(() => buildPresets("mobile"), []);
  const days = buildMonthDays(view.year, view.month, draftStart, draftEnd);
  const hasRange = Boolean(from && to);

  function goPrevMonth() {
    setView((v) => (v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 }));
  }
  function goNextMonth() {
    setView((v) => (v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 }));
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        if (next) {
          resetDraft();
          setView({ year: Number(from.slice(0, 4)), month: Number(from.slice(5, 7)) - 1 });
        }
        setOpen(next);
      }}
    >
      <BottomSheetTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-meta font-semibold active:opacity-70",
            hasRange ? "border-text-1 bg-surface-sunk text-text-1" : "border-rule-strong bg-surface text-text-2",
          )}
        >
          <CalendarIcon className="size-3.5" />
          {hasRange ? `${fmtShort(from)}–${fmtShort(to)}` : "Даты"}
        </button>
      </BottomSheetTrigger>
      <BottomSheetContent>
        <BottomSheetTitle className="sr-only">Выбор периода</BottomSheetTitle>
        <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-1">
          <div className="mb-3.5 flex items-center justify-between">
            <button
              type="button"
              onClick={goPrevMonth}
              className="flex size-8 items-center justify-center"
              aria-label="Предыдущий месяц"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="text-ui font-semibold text-text-1">
              {MONTH_NAMES[view.month]} {view.year}
            </div>
            <button
              type="button"
              onClick={goNextMonth}
              className="flex size-8 items-center justify-center"
              aria-label="Следующий месяц"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-0.5">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id, p.start, p.end)}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-label font-semibold active:opacity-70",
                  activePreset === p.id ? "bg-action text-action-fg" : "bg-surface-sunk text-text-2",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((wd) => (
              <div key={wd} className="text-center text-label font-semibold text-text-3">
                {wd}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => (
              <button
                key={day.key}
                type="button"
                disabled={day.label === null}
                onClick={() => day.label !== null && selectDay(day.key)}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-md text-meta active:opacity-70",
                  day.label === null && "cursor-default",
                  day.isEdge && "bg-action font-semibold text-action-fg",
                  !day.isEdge && day.inRange && "bg-status-progress-tint font-medium text-status-progress",
                  !day.isEdge && !day.inRange && day.label !== null && "font-medium text-text-1",
                )}
              >
                {day.label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex gap-2.5">
            <button
              type="button"
              onClick={() => clearDraft(resetRange.from, resetRange.to)}
              className="h-touch flex-1 rounded-lg bg-surface-sunk text-ui font-semibold text-text-1 active:opacity-70"
            >
              Сбросить
            </button>
            <button
              type="button"
              disabled={!draftEnd}
              onClick={() => {
                commit();
                setOpen(false);
              }}
              className="h-touch flex-1 rounded-lg bg-action text-ui font-semibold text-action-fg disabled:cursor-not-allowed disabled:opacity-50 active:opacity-90"
            >
              Применить
            </button>
          </div>
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}
