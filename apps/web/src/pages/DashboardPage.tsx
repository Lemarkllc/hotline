import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  CircleDot,
  FilePlus2,
  Inbox,
  Star,
  Timer,
  TrendingDown,
  UserCheck,
  UserX,
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
import { APPEAL_TYPE_LABELS, statusColor as appealStatusColor } from "@/components/appeals/badges";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { useAppeals, useReportSummary } from "@/hooks/api";
import { useAuthStore } from "@/lib/authStore";
import { useIsMobile } from "@/hooks/useIsMobile";
import { MobileDashboard } from "@/components/mobile/MobileDashboard";
import { AppSkeleton } from "@/components/mobile/AppSkeleton";

/** Категориальная палитра для 6 типов обращения — привязана к конкретному типу (не
 * позиции в массиве, см. PLAN.md "Заявление на увольнение"), порядок и hex прогнаны
 * через dataviz-валидатор (scripts/validate_palette.js): все проверки CVD/контраста
 * пройдены в обоих режимах на этом порядке слотов. Recharts принимает только
 * строковый литерал цвета, не CSS-переменную/Tailwind-класс — тот же принцип, что и
 * у statusColor() ниже, поэтому дальтоник-безопасность здесь фиксирована на светлой
 * теме (см. design_rework/dashboard_canvas/README решений).
 */
const TYPE_CHART_COLORS: Record<string, string> = {
  VIOLATION: "#e34948",
  QUESTION: "#2a78d6",
  COMPLAINT: "#eb6834",
  SUGGESTION: "#4a3aa7",
  GRATITUDE: "#008300",
  RESIGNATION: "#eda100",
};
const TYPE_CHART_FALLBACK_COLOR = "#6E6C68";

/** Уволено/удержано — бинарный плохой/хороший исход, поэтому носит статусные токены
 * (overdue/closed), а не отдельную категориальную палитру (dataviz-скилл: "when a
 * series means good/bad... it wears status tokens"). */
const RESIGNATION_OUTCOME_COLORS: Record<"TERMINATED" | "WITHDRAWN", string> = {
  TERMINATED: "#C20F1A",
  WITHDRAWN: "#2F6B4F",
};

/** Пустое состояние графика — при нулевом периоде BarChart/PieChart рендерились
 * полностью пустыми без единого сообщения (канвас дашборда явно проектировал
 * "Нет обращений/данных за период", здесь это не было подключено — прогон impeccable). */
function EmptyChartState({ label }: { label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <BarChart3 className="size-7 text-text-3" strokeWidth={1.5} />
      <p className="text-meta text-text-3">{label}</p>
    </div>
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
  const resignationData = [
    { key: "TERMINATED" as const, name: "Уволено", value: data.resignationsTerminated },
    { key: "WITHDRAWN" as const, name: "Удержано", value: data.resignationsWithdrawn },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-title font-bold text-text-1">Обзор</h1>
        <p className="mt-0.5 text-meta text-text-3">Последние {days} дней</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard label="Создано" value={data.created} icon={FilePlus2} accent="neutral" to="/appeals" />
        <KpiCard label="Открыто" value={data.byStatus.OPEN ?? 0} icon={CircleDot} accent="open" to="/appeals?status=OPEN" />
        <KpiCard
          label="В работе"
          value={data.byStatus.IN_PROGRESS ?? 0}
          icon={Activity}
          accent="progress"
          to="/appeals?status=IN_PROGRESS"
        />
        <KpiCard label="Закрыто" value={data.byStatus.CLOSED ?? 0} icon={CheckCircle2} accent="closed" to="/appeals?status=CLOSED" />
        {/* backlogAtPeriodEnd — та же очередь, что и "Только бэклог" на реестре обращений
         * (OPEN/UNDER_REVIEW без назначенного менеджера), уже посчитана бэкендом. */}
        <KpiCard
          label="Без ответственного"
          value={data.backlogAtPeriodEnd}
          icon={Inbox}
          accent="review"
          to="/appeals?backlogOnly=true"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard label="Средняя оценка" value={data.avgRating?.toFixed(1) ?? "—"} icon={Star} accent="neutral" />
        <KpiCard
          label="Низкие оценки"
          value={data.lowRatingShare !== null ? `${data.lowRatingShare.toFixed(0)}%` : "—"}
          icon={TrendingDown}
          accent="overdue"
          to="/appeals?lowRatingOnly=true"
        />
        <KpiCard
          label="Реакция (ср.)"
          value={data.avgFirstResponseMinutes !== null ? `${Math.round(data.avgFirstResponseMinutes / 60)} ч` : "—"}
          icon={Timer}
          accent="neutral"
        />
        {/* Увольнения существуют только на канале EMPLOYEE (RESIGNATION — тип обращения
         * только там) — на CUSTOMER (роль SALES) эти плитки всегда были бы "0" и не
         * несут смысла, только путают. */}
        {activeChannel === "EMPLOYEE" && (
          <>
            <KpiCard label="Уволено" value={data.resignationsTerminated} icon={UserX} accent="overdue" to="/appeals?type=RESIGNATION" />
            <KpiCard label="Удержано" value={data.resignationsWithdrawn} icon={UserCheck} accent="closed" to="/appeals?type=RESIGNATION" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-4 pb-0">
            <CardTitle className="text-ui">По статусам</CardTitle>
          </CardHeader>
          <CardContent className="h-64 p-4">
            {statusData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--lm-rule)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6E6C68" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#6E6C68" }} />
                  <Tooltip />
                  <Bar
                    dataKey="value"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    onClick={(entry) => navigate(`/appeals?status=${entry.key}`)}
                  >
                    {statusData.map((d) => (
                      <Cell key={d.key} fill={appealStatusColor(d.key as AppealStatus)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState label="Нет обращений за период" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-0">
            <CardTitle className="text-ui">По типам</CardTitle>
          </CardHeader>
          <CardContent className="flex h-64 items-center gap-6 p-4">
            {typeData.length ? (
              <>
                <ResponsiveContainer width="50%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={2}
                      cursor="pointer"
                      onClick={(entry) => navigate(`/appeals?type=${entry.key}`)}
                    >
                      {typeData.map((d) => (
                        <Cell key={d.key} fill={TYPE_CHART_COLORS[d.key] ?? TYPE_CHART_FALLBACK_COLOR} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                {/* Прямые подписи легенды — donut без встроенных label-линий читается яснее
                 * при 6 категориях (dataviz-скилл: "selective direct labels, never a number
                 * on every point"). */}
                <div className="flex flex-1 flex-col gap-2">
                  {typeData.map((d) => (
                    <div key={d.key} className="flex items-center gap-2 text-meta text-text-2">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: TYPE_CHART_COLORS[d.key] ?? TYPE_CHART_FALLBACK_COLOR }}
                      />
                      <span className="truncate">{d.name}</span>
                      <span className="ml-auto font-mono tabular-nums text-text-1">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyChartState label="Нет данных за период" />
            )}
          </CardContent>
        </Card>

        {activeChannel === "EMPLOYEE" && (
          <Card>
            <CardHeader className="p-4 pb-0">
              <CardTitle className="text-ui">Увольнения: уволено vs удержано</CardTitle>
            </CardHeader>
            <CardContent className="h-64 p-4">
              {resignationData.some((d) => d.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={resignationData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--lm-rule)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6E6C68" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#6E6C68" }} />
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
              ) : (
                <EmptyChartState label="Увольнений не было" />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
