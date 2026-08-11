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
  const { draftStart, draftEnd, activePreset, selectDay, applyPreset, reset, resetDraft } = useDateRangeSelection({
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
            "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-semibold",
            hasRange ? "border-primary bg-[#EFF6FF] text-primary" : "border-border bg-surface text-[#475569]",
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
            <div className="text-[14px] font-bold text-foreground">
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
                  "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold",
                  activePreset === p.id ? "bg-[#EFF6FF] text-primary" : "bg-background text-[#475569]",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((wd) => (
              <div key={wd} className="text-center text-[11px] font-semibold text-muted-foreground">
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
                  "flex aspect-square items-center justify-center rounded-[10px] text-[13px]",
                  day.label === null && "cursor-default",
                  day.isEdge && "bg-primary font-bold text-primary-foreground",
                  !day.isEdge && day.inRange && "bg-[#DBEAFE] font-medium text-[#1E40AF]",
                  !day.isEdge && !day.inRange && day.label !== null && "font-medium text-foreground",
                )}
              >
                {day.label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex gap-2.5">
            <button
              type="button"
              onClick={() => reset(resetRange.from, resetRange.to)}
              className="h-11 flex-1 rounded-xl bg-background text-[14px] font-semibold text-foreground"
            >
              Сбросить
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-11 flex-1 rounded-xl bg-primary text-[14px] font-semibold text-primary-foreground"
            >
              Применить
            </button>
          </div>
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}
