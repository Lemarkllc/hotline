import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Пилюли — пара «цвет текста на тинте» из status-* токенов (design_handoff_lemark_one/
 * README.md "Цвет"). variant-имена сохранены (default/success/warning/destructive/
 * confidential/outline) — переиспользуются существующими вызывающими без смены сигнатуры,
 * значения теперь читаются из единой лемарковской палитры вместо разрозненных hex. */
const badgeVariants = cva("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-meta font-medium", {
  variants: {
    variant: {
      default: "bg-status-open-tint text-status-open",
      progress: "bg-status-progress-tint text-status-progress",
      success: "bg-status-closed-tint text-status-closed",
      warning: "bg-status-review-tint text-status-review",
      destructive: "bg-status-overdue-tint text-status-overdue",
      confidential: "bg-confidential-tint text-confidential",
      outline: "border border-rule-strong text-text-1",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
