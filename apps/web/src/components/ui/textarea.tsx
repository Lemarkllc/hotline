import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-20 w-full rounded-md border border-rule-strong bg-surface px-3 py-2 text-ui text-text-1",
        "placeholder:text-text-3 disabled:cursor-not-allowed disabled:opacity-50",
        "aria-[invalid=true]:border-status-overdue",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
