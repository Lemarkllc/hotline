import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type Accent = "slate" | "primary" | "success" | "warning" | "destructive";

const ACCENT_STYLES: Record<Accent, { icon: string; ring: string }> = {
  slate: { icon: "bg-slate-100 text-slate-600", ring: "hover:border-slate-400" },
  primary: { icon: "bg-primary/10 text-primary", ring: "hover:border-primary" },
  success: { icon: "bg-success/10 text-success", ring: "hover:border-success" },
  warning: { icon: "bg-warning/10 text-warning", ring: "hover:border-warning" },
  destructive: { icon: "bg-destructive/10 text-destructive", ring: "hover:border-destructive" },
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
    <CardContent className="flex items-start gap-3 p-5">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", style.icon)}>
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </CardContent>
  );

  if (!to) return <Card>{content}</Card>;

  return (
    <Link
      to={to}
      className={cn(
        "block rounded-lg border border-border bg-surface shadow-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        style.ring,
      )}
    >
      {content}
    </Link>
  );
}
