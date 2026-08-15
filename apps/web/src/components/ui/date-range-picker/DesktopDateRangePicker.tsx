import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildMonthDays,
  buildPresets,
  fmtShort,
  MONTH_NAMES,
  useDateRangeSelection,
  WEEKDAYS,
  type CalendarDay,
  type DateRangePickerProps,
} from "./shared";

function MonthGrid({ days, onSelect }: { days: CalendarDay[]; onSelect: (key: string) => void }) {
  return (
    <div className="grid grid-cols-[repeat(7,28px)] gap-0.5">
      {WEEKDAYS.map((wd) => (
        <div key={wd} className="flex h-6 items-center justify-center text-[11px] font-semibold text-muted-foreground">
          {wd}
        </div>
      ))}
      {days.map((day) => (
        <button
          key={day.key}
          type="button"
          disabled={day.label === null}
          onClick={() => day.label !== null && onSelect(day.key)}
          className={cn(
            "flex size-7 items-center justify-center rounded-md text-[13px]",
            day.label === null && "cursor-default",
            day.isEdge && "bg-primary font-bold text-primary-foreground",
            !day.isEdge && day.inRange && "bg-[#DBEAFE] font-medium text-[#1E40AF]",
            !day.isEdge && !day.inRange && day.label !== null && "font-medium text-foreground hover:bg-background",
          )}
        >
          {day.label}
        </button>
      ))}
    </div>
  );
}

/** Десктопный дейт-рендж пикер — попап с колонкой пресетов + два месяца рядом, по
 * design_handoff_mobile_pwa/Data picker/Desktop Date Range Picker.dc.html. Мобильный
 * вариант — отдельный компонент (MobileDateRangePicker), не внутренняя ветка тут:
 * страницы уже сами решают desktop/mobile на своём уровне (LeadsPage → MobileLeadsRegistry),
 * этот компонент повторяет тот же принцип, а не проталкивает useIsMobile() внутрь. */
export function DesktopDateRangePicker({ from, to, onChange, resetRange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => ({ year: Number(from.slice(0, 4)), month: Number(from.slice(5, 7)) - 1 }));
  const { draftStart, draftEnd, activePreset, selectDay, applyPreset, clearDraft, commit, reset, resetDraft } = useDateRangeSelection({
    from,
    to,
    onChange,
  });

  const presets = useMemo(() => buildPresets("desktop"), []);

  const nextMonth = view.month === 11 ? 0 : view.month + 1;
  const nextYear = view.month === 11 ? view.year + 1 : view.year;

  function goPrevMonth() {
    setView((v) => (v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 }));
  }
  function goNextMonth() {
    setView((v) => (v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 }));
  }

  const daysA = buildMonthDays(view.year, view.month, draftStart, draftEnd);
  const daysB = buildMonthDays(nextYear, nextMonth, draftStart, draftEnd);

  const summary =
    draftStart && draftEnd
      ? `${fmtShort(draftStart)} – ${fmtShort(draftEnd)}`
      : draftStart
        ? "Выберите конечную дату"
        : "Диапазон не выбран";

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          resetDraft();
          setView({ year: Number(from.slice(0, 4)), month: Number(from.slice(5, 7)) - 1 });
        }
        setOpen(next);
      }}
    >
      {/* Две настоящие кнопки в общей рамке-пилюле, не вложенный role="button" внутри
          <button> — прошлая разметка была невалидным HTML и недостижима с клавиатуры
          (tabIndex={-1} убирал "×" из Tab-порядка целиком, подтверждено живой
          проверкой через playwright-cli). */}
      <div className="flex h-10 items-center rounded-md border border-border bg-surface text-sm text-foreground">
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-full min-w-[44px] items-center gap-2 rounded-l-md px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          >
            <CalendarIcon className="size-4 text-muted-foreground" />
            <span>
              {fmtShort(from)} – {fmtShort(to)}
            </span>
          </button>
        </PopoverTrigger>
        <button
          type="button"
          onClick={() => reset(resetRange.from, resetRange.to)}
          className="flex h-full items-center rounded-r-md border-l border-border px-2 text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          aria-label="Сбросить диапазон"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <PopoverContent className="flex p-0">
        <div className="flex w-[150px] flex-col gap-0.5 border-r border-border p-2">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id, p.start, p.end)}
              className={cn(
                "rounded-md px-2.5 py-2 text-left text-[13px]",
                activePreset === p.id ? "bg-[#EFF6FF] text-primary" : "text-foreground hover:bg-background",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={goPrevMonth}
              className="flex size-7 items-center justify-center rounded-md hover:bg-background"
              aria-label="Предыдущий месяц"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="flex gap-16">
              <div className="text-[13px] font-semibold text-foreground">
                {MONTH_NAMES[view.month]} {view.year}
              </div>
              <div className="text-[13px] font-semibold text-foreground">
                {MONTH_NAMES[nextMonth]} {nextYear}
              </div>
            </div>
            <button
              type="button"
              onClick={goNextMonth}
              className="flex size-7 items-center justify-center rounded-md hover:bg-background"
              aria-label="Следующий месяц"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="flex gap-6">
            <MonthGrid days={daysA} onSelect={selectDay} />
            <MonthGrid days={daysB} onSelect={selectDay} />
          </div>

          <div className="mt-3.5 flex items-center justify-between border-t border-border pt-3">
            <div className="text-[13px] text-muted-foreground">{summary}</div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => clearDraft(resetRange.from, resetRange.to)}>
                Сбросить
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!draftEnd}
                onClick={() => {
                  commit();
                  setOpen(false);
                }}
              >
                Применить
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
