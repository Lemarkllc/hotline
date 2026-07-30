import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  CheckCircle2,
  CircleDot,
  FilePlus2,
  Star,
  Timer,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { APPEAL_STATUS_LABELS, type AppealStatus } from "@hotline/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APPEAL_TYPE_LABELS, statusColor } from "@/components/appeals/badges";
import { cn } from "@/lib/utils";
import { useAppeals, useReportSummary } from "@/hooks/api";
import { useAuthStore } from "@/lib/authStore";
import { useIsMobile } from "@/hooks/useIsMobile";
import { MobileDashboard } from "@/components/mobile/MobileDashboard";
import { AppSkeleton } from "@/components/mobile/AppSkeleton";

const TYPE_CHART_COLORS = ["#2563EB", "#7C3AED", "#16A34A", "#D97706", "#DC2626"];

/** Тот же цветовой язык, что и в Kanban-колонках (KanbanBoard.tsx) — воронка
 * читается одинаково что на доске, что на дашборде. */
const STATUS_COLORS: Record<AppealStatus, string> = {
  OPEN: "#94A3B8",
  UNDER_REVIEW: "#D97706",
  IN_PROGRESS: "#2563EB",
  CLOSED: "#16A34A",
};

type Accent = "slate" | "primary" | "success" | "warning" | "destructive";

const ACCENT_STYLES: Record<Accent, { icon: string; ring: string }> = {
  slate: { icon: "bg-slate-100 text-slate-600", ring: "hover:border-slate-400" },
  primary: { icon: "bg-primary/10 text-primary", ring: "hover:border-primary" },
  success: { icon: "bg-success/10 text-success", ring: "hover:border-success" },
  warning: { icon: "bg-warning/10 text-warning", ring: "hover:border-warning" },
  destructive: { icon: "bg-destructive/10 text-destructive", ring: "hover:border-destructive" },
};

function KpiCard({
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

export function DashboardPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const activeChannel = useAuthStore((s) => s.activeChannel);
  const userName = useAuthStore((s) => s.user?.fullName ?? "");
  const [days] = useState(30);
  const { from, to } = useMemo(() => {
    const now = new Date();
    const past = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return { from: past.toISOString(), to: now.toISOString() };
  }, [days]);

  const { data, isLoading } = useReportSummary(activeChannel, from, to);
  // Только для мобильного "Последние обращения" — десктопный дашборд обходится без
  // него (там для этого есть отдельный раздел "Обращения" с полноценным реестром).
  const { data: recent } = useAppeals({ channel: activeChannel, page: 1, pageSize: 3 });

  if (isLoading || !data) {
    // На мобильном — тот же скелетон, что и на старте приложения (см. App.tsx/AppSkeleton):
    // это первый экран после входа, "Загрузка..." голым текстом здесь так же чужеродно
    // смотрелась бы после сплэша, как и на самом старте.
    return isMobile ? <AppSkeleton /> : <p className="text-muted-foreground">Загрузка...</p>;
  }

  if (isMobile) {
    return <MobileDashboard userName={userName} data={data} recentAppeals={recent?.items ?? []} />;
  }

  const statusData = Object.entries(data.byStatus).map(([status, count]) => ({
    key: status,
    name: APPEAL_STATUS_LABELS[status as AppealStatus] ?? status,
    value: count,
  }));
  const typeData = Object.entries(data.byType).map(([type, count]) => ({
    key: type,
    name: APPEAL_TYPE_LABELS[type] ?? type,
    value: count,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Последние {days} дней</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Создано" value={data.created} icon={FilePlus2} accent="slate" to="/appeals" />
        <KpiCard
          label="Открыто"
          value={data.byStatus.OPEN ?? 0}
          icon={CircleDot}
          accent="slate"
          to="/appeals?status=OPEN"
        />
        <KpiCard
          label="В работе"
          value={data.byStatus.IN_PROGRESS ?? 0}
          icon={Activity}
          accent="primary"
          to="/appeals?status=IN_PROGRESS"
        />
        <KpiCard
          label="Закрыто"
          value={data.byStatus.CLOSED ?? 0}
          icon={CheckCircle2}
          accent="success"
          to="/appeals?status=CLOSED"
        />
        <KpiCard
          label="Средняя оценка"
          value={data.avgRating?.toFixed(1) ?? "—"}
          icon={Star}
          accent="primary"
        />
        <KpiCard
          label="Низкие оценки"
          value={data.lowRatingShare !== null ? `${data.lowRatingShare.toFixed(0)}%` : "—"}
          icon={TrendingDown}
          accent="destructive"
          to="/appeals?lowRatingOnly=true"
        />
        <KpiCard
          label="Реакция (ср.)"
          value={data.avgFirstResponseMinutes !== null ? `${Math.round(data.avgFirstResponseMinutes / 60)} ч` : "—"}
          icon={Timer}
          accent="slate"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>По статусам</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar
                  dataKey="value"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(entry) => navigate(`/appeals?status=${entry.key}`)}
                >
                  {statusData.map((d) => (
                    <Cell key={d.key} fill={STATUS_COLORS[d.key as AppealStatus]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>По типам</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={90}
                  label
                  cursor="pointer"
                  onClick={(entry) => navigate(`/appeals?type=${entry.key}`)}
                >
                  {typeData.map((d, i) => (
                    <Cell key={d.key} fill={TYPE_CHART_COLORS[i % TYPE_CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
