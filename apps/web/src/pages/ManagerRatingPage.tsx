import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DesktopDateRangePicker } from "@/components/ui/date-range-picker/DesktopDateRangePicker";
import { useManagerLeadStats, useManagerLeadWeeklyTrend, type ManagerLeadStatsDTO } from "@/hooks/api";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Фиксированный порядок и цвета на менеджера — dataviz-принцип "категориальные
 * оттенки в фиксированном порядке, не циклически". Порядок совпадает с тем, что
 * отдаёт бэкенд (managerLeadRatingService — по ROSTER_IDS), поэтому индекс строки
 * стата и индекс здесь всегда один и тот же менеджер. */
const MANAGER_COLORS = ["#96631A", "#2F6B4F", "#4A5568", "#C2410C", "#6D28D9", "#0E7490"];

type SortKey = "name" | "total" | "slaViolations" | "notConvertedRate" | "junkRate";

function formatPercent(v: number | null): string {
  return v == null ? "—" : `${v.toFixed(0)}%`;
}

function formatWeekLabel(week: string): string {
  return new Date(week).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

type TrendMetricKey = "slaViolations" | "notConvertedRate" | "junkRate";

function TrendChart({
  title,
  data,
  managers,
  metricKey,
  valueFormatter,
}: {
  title: string;
  data: { week: string; byManager: Record<string, { slaViolations: number; notConvertedRate: number | null; junkRate: number | null }> }[];
  managers: ManagerLeadStatsDTO[];
  metricKey: TrendMetricKey;
  valueFormatter: (v: number) => string;
}) {
  // Recharts не умеет читать вложенный byManager[id] через dataKey-строку с точкой
  // (id — произвольная строка Bitrix, не безопасный JS-идентификатор для пути) —
  // разворачиваем в плоский объект на неделю: { week, [managerId]: value }.
  const flat = useMemo(
    () =>
      data.map((point) => {
        const row: Record<string, number | string> = { week: point.week };
        for (const m of managers) {
          row[m.assignedById] = point.byManager[m.assignedById]?.[metricKey] ?? 0;
        }
        return row;
      }),
    [data, managers, metricKey],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={flat} margin={{ right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DD" vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 12 }} tickFormatter={formatWeekLabel} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip labelFormatter={formatWeekLabel} formatter={(v: number) => valueFormatter(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {managers.map((m, i) => (
              <Line
                key={m.assignedById}
                type="monotone"
                dataKey={m.assignedById}
                name={m.name}
                stroke={MANAGER_COLORS[i % MANAGER_COLORS.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/** «Рейтинг менеджеров» по лидам (grill-me допрос 2026-09-12) — три тренда сверху
 * (недельная динамика, линия на менеджера), плоская сортируемая таблица снизу с
 * текущими цифрами за выбранный период. Без композитного score (решение
 * пользователя) — три метрики рядом, сортировка на усмотрение смотрящего. */
export function ManagerRatingPage() {
  const resetRange = useMemo(
    () => ({ from: isoDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)), to: isoDate(new Date()) }),
    [],
  );
  const [from, setFrom] = useState(resetRange.from);
  const [to, setTo] = useState(resetRange.to);
  const [sortKey, setSortKey] = useState<SortKey>("slaViolations");
  const [sortDesc, setSortDesc] = useState(true);

  const { data: stats, isLoading: statsLoading, isError: statsError } = useManagerLeadStats(from, to);
  const { data: trend } = useManagerLeadWeeklyTrend(from, to);

  const sortedStats = useMemo(() => {
    const rows = [...(stats ?? [])];
    rows.sort((a, b) => {
      if (sortKey === "name") {
        const cmp = a.name.localeCompare(b.name);
        return sortDesc ? -cmp : cmp;
      }
      // null (нет данных за период) — всегда в конец, независимо от направления сортировки.
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return sortDesc ? bv - av : av - bv;
    });
    return rows;
  }, [stats, sortKey, sortDesc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDesc((v) => !v);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  function SortHeader({ label, sortKeyValue }: { label: string; sortKeyValue: SortKey }) {
    const active = sortKey === sortKeyValue;
    return (
      <button
        type="button"
        onClick={() => toggleSort(sortKeyValue)}
        className="flex items-center gap-1 text-label font-medium uppercase tracking-wide text-text-3 hover:text-text-1"
      >
        {label}
        {active && (sortDesc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-title font-bold text-text-1">Рейтинг менеджеров</h1>
        <DesktopDateRangePicker
          from={from}
          to={to}
          onChange={(f, t) => {
            setFrom(f);
            setTo(t);
          }}
          resetRange={resetRange}
        />
      </div>

      {statsError && (
        <p className="rounded-md border border-status-overdue/30 bg-status-overdue-tint px-3 py-2 text-ui text-status-overdue">
          Не удалось загрузить данные.
        </p>
      )}

      {!!stats?.length && !!trend?.length && (
        <>
          <TrendChart
            title="SLA-нарушений по неделям"
            data={trend}
            managers={stats}
            metricKey="slaViolations"
            valueFormatter={(v) => `${v}`}
          />
          <TrendChart
            title="Не переведено в CRM по неделям"
            data={trend}
            managers={stats}
            metricKey="notConvertedRate"
            valueFormatter={(v) => `${v.toFixed(0)}%`}
          />
          <TrendChart
            title="Провалено по неделям"
            data={trend}
            managers={stats}
            metricKey="junkRate"
            valueFormatter={(v) => `${v.toFixed(0)}%`}
          />
        </>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-5 gap-2 border-b border-rule bg-surface-sunk px-4 py-2.5">
            <SortHeader label="Менеджер" sortKeyValue="name" />
            <SortHeader label="Создано" sortKeyValue="total" />
            <SortHeader label="SLA-нарушений" sortKeyValue="slaViolations" />
            <SortHeader label="Не переведено" sortKeyValue="notConvertedRate" />
            <SortHeader label="Провалено" sortKeyValue="junkRate" />
          </div>
          {statsLoading && <p className="p-4 text-ui text-text-3">Загрузка…</p>}
          {!statsLoading &&
            sortedStats.map((m) => (
              <div key={m.assignedById} className="grid grid-cols-5 gap-2 border-b border-rule px-4 py-3 last:border-b-0">
                <span className="text-ui font-medium text-text-1">{m.name}</span>
                <span className="font-mono text-ui tabular-nums text-text-2">{m.total}</span>
                <span className="font-mono text-ui tabular-nums text-text-2">{m.slaViolations}</span>
                <span className="font-mono text-ui tabular-nums text-text-2">{formatPercent(m.notConvertedRate)}</span>
                <span className="font-mono text-ui tabular-nums text-text-2">{formatPercent(m.junkRate)}</span>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
