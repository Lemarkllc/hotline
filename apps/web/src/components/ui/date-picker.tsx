import { useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildMonthDays, MONTH_NAMES, toKey, WEEKDAYS } from "@/components/ui/date-range-picker/shared";

function fmtFull(key: string): string {
  const [y, mo, da] = key.split("-");
  return `${da}.${mo}.${y}`;
}

function todayKey(): string {
  const t = new Date();
  return toKey(t.getFullYear(), t.getMonth(), t.getDate());
}

interface DatePickerProps {
  /** "YYYY-MM-DD" или null — тот же формат, что отдают/принимают поля User.hireDate
   * и VacationBalance.asOfDate через API (см. UsersPage/EmployeeBalancesTab). */
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/** Кастомный однодневный дата-пикер вместо нативного `<input type="date">` (решение
 * пользователя — браузерный виджет визуально не вписывался в Lemark One). Логика
 * сетки месяца (buildMonthDays/toKey/MONTH_NAMES/WEEKDAYS) переиспользована из
 * date-range-picker/shared.ts — та же математика в локальном времени, тот же
 * визуальный язык, что и у DesktopDateRangePicker, просто без диапазона/пресетов:
 * клик по дню коммитит сразу, черновик тут не нужен (одна дата, не пара). */
export function DatePicker({ value, onChange, placeholder = "Выберите дату", disabled, className }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const anchor = value ?? todayKey();
    return { year: Number(anchor.slice(0, 4)), month: Number(anchor.slice(5, 7)) - 1 };
  });

  function openChange(next: boolean) {
    if (next) {
      const anchor = value ?? todayKey();
      setView({ year: Number(anchor.slice(0, 4)), month: Number(anchor.slice(5, 7)) - 1 });
    }
    setOpen(next);
  }

  function goPrevMonth() {
    setView((v) => (v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 }));
  }
  function goNextMonth() {
    setView((v) => (v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 }));
  }

  const days = buildMonthDays(view.year, view.month, value, value);

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-control w-full items-center gap-2 rounded-md border border-rule-strong bg-surface px-3 text-ui text-text-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-action",
            className,
          )}
        >
          <CalendarIcon className="size-4 shrink-0 text-text-3" />
          <span className={value ? undefined : "text-text-3"}>{value ? fmtFull(value) : placeholder}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent portal={false} className="w-auto p-4">
        <div className="mb-3 flex items-center justify-between gap-6">
          <button
            type="button"
            onClick={goPrevMonth}
            className="flex size-7 items-center justify-center rounded-md hover:bg-surface-sunk"
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
            className="flex size-7 items-center justify-center rounded-md hover:bg-surface-sunk"
            aria-label="Следующий месяц"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-[repeat(7,28px)] gap-0.5">
          {WEEKDAYS.map((wd) => (
            <div key={wd} className="flex h-6 items-center justify-center text-label font-semibold text-text-3">
              {wd}
            </div>
          ))}
          {days.map((day) => (
            <button
              key={day.key}
              type="button"
              disabled={day.label === null}
              onClick={() => {
                if (day.label === null) return;
                onChange(day.key);
                setOpen(false);
              }}
              className={cn(
                "flex size-7 items-center justify-center rounded-md text-meta",
                day.label === null && "cursor-default",
                day.isEdge && "bg-action font-bold text-action-fg",
                !day.isEdge && day.label !== null && "font-medium text-text-1 hover:bg-surface-sunk",
              )}
            >
              {day.label}
            </button>
          ))}
        </div>

        <div className="mt-3.5 flex items-center justify-between border-t border-rule pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onChange(todayKey());
              setOpen(false);
            }}
          >
            Сегодня
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!value}
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            Очистить
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
