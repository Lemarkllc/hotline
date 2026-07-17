import { useMemo, useState } from "react";
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
import { APPEAL_STATUS_LABELS, EMPLOYEE_APPEAL_TYPE_LABELS, type EmployeeAppealType } from "@hotline/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useReportSummary } from "@/hooks/api";

const CHART_COLORS = ["#2563EB", "#7C3AED", "#16A34A", "#D97706", "#DC2626"];

function KpiCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const [days] = useState(30);
  const { from, to } = useMemo(() => {
    const now = new Date();
    const past = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return { from: past.toISOString(), to: now.toISOString() };
  }, [days]);

  const { data, isLoading } = useReportSummary("EMPLOYEE", from, to);

  if (isLoading || !data) {
    return <p className="text-muted-foreground">Загрузка...</p>;
  }

  const statusData = Object.entries(data.byStatus).map(([status, count]) => ({
    name: APPEAL_STATUS_LABELS[status as keyof typeof APPEAL_STATUS_LABELS] ?? status,
    value: count,
  }));
  const typeData = Object.entries(data.byType).map(([type, count]) => ({
    name: EMPLOYEE_APPEAL_TYPE_LABELS[type as EmployeeAppealType] ?? type,
    value: count,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Последние {days} дней</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Создано" value={data.created} />
        <KpiCard label="Открыто" value={data.byStatus.OPEN ?? 0} />
        <KpiCard label="В работе" value={data.byStatus.IN_PROGRESS ?? 0} />
        <KpiCard label="Закрыто" value={data.byStatus.CLOSED ?? 0} />
        <KpiCard label="Средняя оценка" value={data.avgRating?.toFixed(1) ?? "—"} />
        <KpiCard
          label="Низкие оценки"
          value={data.lowRatingShare !== null ? `${data.lowRatingShare.toFixed(0)}%` : "—"}
        />
        <KpiCard
          label="Реакция (ср.)"
          value={data.avgFirstResponseMinutes !== null ? `${Math.round(data.avgFirstResponseMinutes / 60)} ч` : "—"}
        />
        <KpiCard label="Backlog" value={data.backlogAtPeriodEnd} />
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
                <Bar dataKey="value" fill="#2563EB" radius={[4, 4, 0, 0]} />
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
                <Pie data={typeData} dataKey="value" nameKey="name" outerRadius={90} label>
                  {typeData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
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
