import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Тинт плитки — status-* токены Lemark One (design_rework/dashboard_canvas/Main.dc.html),
 * не общий accent-словарь: тайл "Без ответственного" носит тот же янтарный, что и
 * пилюля "На проверке", "Уволено"/"Низкие оценки" — тот же красный, что и "Просрочено". */
export type Accent = "neutral" | "open" | "review" | "progress" | "closed" | "overdue";

const ACCENT_STYLES: Record<Accent, { icon: string; value?: string }> = {
  neutral: { icon: "bg-surface-sunk text-text-2" },
  open: { icon: "bg-status-open-tint text-status-open" },
  review: { icon: "bg-status-review-tint text-status-review", value: "text-status-review" },
  progress: { icon: "bg-status-progress-tint text-status-progress" },
  closed: { icon: "bg-status-closed-tint text-status-closed", value: "text-status-closed" },
  overdue: { icon: "bg-status-overdue-tint text-status-overdue", value: "text-status-overdue" },
};

/** Общий KPI-тайл — используется и на DashboardPage, и на LeadsPage (конверсия
 * email → CRM, см. PLAN.md "«Заявки» — email-лиды..."). */
export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  to,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  accent: Accent;
  to?: string;
}) {
  const style = ACCENT_STYLES[accent];
  const content = (
    <CardContent className="flex items-start gap-3 p-4">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", style.icon)}>
        <Icon className="size-[18px]" strokeWidth={1.5} />
      </span>
      <div>
        <p className="text-meta text-text-3">{label}</p>
        <p className={cn("mt-0.5 font-mono text-title font-semibold tabular-nums", style.value ?? "text-text-1")}>
          {value}
        </p>
        {hint && <p className="mt-0.5 text-meta text-text-3">{hint}</p>}
      </div>
    </CardContent>
  );

  if (!to) return <Card>{content}</Card>;

  return (
    <Link to={to} className="block rounded-lg border border-rule bg-surface transition-colors duration-1 hover:border-rule-strong">
      {content}
    </Link>
  );
}
