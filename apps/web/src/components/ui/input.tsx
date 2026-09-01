import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-control w-full rounded-md border border-rule-strong bg-surface px-3 py-2 text-ui text-text-1",
        "placeholder:text-text-3 disabled:cursor-not-allowed disabled:opacity-50",
        // Ошибка — красная рамка 1px (правило хендоффа: красный только там, где что-то
        // реально пошло не так). aria-invalid ставится вызывающим кодом на поле с ошибкой.
        "aria-[invalid=true]:border-status-overdue",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
