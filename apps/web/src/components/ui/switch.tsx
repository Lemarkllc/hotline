import * as React from "react";
import { cn } from "@/lib/utils";

/** Простой булев переключатель — в проекте нет ни одного (Dialog/Label/Popover/
 * Select/Tabs есть, Switch — нет), заводить ради одного тумблера Radix-зависимость
 * не стали: role="switch" на обычной кнопке достаточен и без внешнего примитива. */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-action" : "bg-rule-strong",
        className,
      )}
    >
      <span
        className={cn(
          "inline-block size-4 rounded-full bg-surface shadow-sm transition-transform duration-1",
          checked ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
