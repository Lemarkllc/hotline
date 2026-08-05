import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, CheckCircle2, CircleDot, FilePlus2, Star, Timer, TrendingDown, UserCheck, UserX } from "lucide-react";
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
import { KpiCard } from "@/components/dashboard/KpiCard";
import { useAppeals, useReportSummary } from "@/hooks/api";
import { useAuthStore } from "@/lib/authStore";
import { useIsMobile } from "@/hooks/useIsMobile";
import { MobileDashboard } from "@/components/mobile/MobileDashboard";
import { AppSkeleton } from "@/components/mobile/AppSkeleton";

// Привязано к конкретному типу (не позиции в массиве) — иначе следующий добавленный
// тип молча переиспользует чужой цвет (см. PLAN.md "Заявление на увольнение").
const TYPE_CHART_COLORS: Record<string, string> = {
  COMPLAINT: "#2563EB",
  SUGGESTION: "#7C3AED",
  VIOLATION: "#DC2626",
  QUESTION: "#0891B2",
  GRATITUDE: "#16A34A",
  RESIGNATION: "#D97706",
};
const TYPE_CHART_FALLBACK_COLOR = "#64748B";

const RESIGNATION_OUTCOME_COLORS: Record<"TERMINATED" | "WITHDRAWN", string> = {
  TERMINATED: "#DC2626",
  WITHDRAWN: "#16A34A",
};

/** Тот же цветовой язык, что и в Kanban-колонках (KanbanBoard.tsx) — воронка
 * читается одинаково что на доске, что на дашборде. */
const STATUS_COLORS: Record<AppealStatus, string> = {
  OPEN: "#94A3B8",
  UNDER_REVIEW: "#D97706",
  IN_PROGRESS: "#2563EB",
  CLOSED: "#16A34A",
};

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
  const resignationData = [
    { key: "TERMINATED" as const, name: "Уволено", value: data.resignationsTerminated },
    { key: "WITHDRAWN" as const, name: "Удержано", value: data.resignationsWithdrawn },
  ];

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
        <KpiCard
          label="Уволено"
          value={data.resignationsTerminated}
          icon={UserX}
          accent="destructive"
          to="/appeals?type=RESIGNATION"
        />
        <KpiCard
          label="Удержано"
          value={data.resignationsWithdrawn}
          icon={UserCheck}
          accent="success"
          to="/appeals?type=RESIGNATION"
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
                  {typeData.map((d) => (
                    <Cell key={d.key} fill={TYPE_CHART_COLORS[d.key] ?? TYPE_CHART_FALLBACK_COLOR} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Увольнения: уволено vs удержано</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={resignationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar
                  dataKey="value"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={() => navigate("/appeals?type=RESIGNATION")}
                >
                  {resignationData.map((d) => (
                    <Cell key={d.key} fill={RESIGNATION_OUTCOME_COLORS[d.key]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
