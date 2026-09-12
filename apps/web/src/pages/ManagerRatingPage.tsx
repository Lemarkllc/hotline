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

/** count/total (%) вместо голого процента — заказчик прямо попросил видеть, из чего
 * процент считался (2026-09-12, живая проверка страницы): "35%" при 2 лидах из 6
 * читается совсем не так, как "35%" при 200 из 570. */
function formatCountRate(count: number, total: number): string {
  if (total === 0) return "—";
  return `${count}/${total} (${Math.round((count / total) * 100)}%)`;
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

/** «Рейтинг менеджеров» по лидам (grill-me допрос 2026-09-12) — один тренд сверху
 * (SLA-нарушения по неделям, линия на менеджера — единственная метрика, где недельная
 * динамика физически читается, см. правку 2026-09-12), плоская сортируемая таблица
 * снизу с текущими цифрами за весь выбранный период. Без композитного score
 * (решение пользователя) — три метрики рядом, сортировка на усмотрение смотрящего. */
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

  function SortHeader({ label, sortKeyValue, hint }: { label: string; sortKeyValue: SortKey; hint?: string }) {
    const active = sortKey === sortKeyValue;
    return (
      <button
        type="button"
        onClick={() => toggleSort(sortKeyValue)}
        title={hint}
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

      {/* Только SLA-нарушения трендом — реальные счётные события. "Не переведено в
          сделку"/"провалено" по неделям убраны (2026-09-12, живая проверка страницы):
          при малом числе лидов на менеджера в неделю проценты скачут почти случайно,
          тренда физически не видно. Обе метрики остаются в таблице снизу — там за
          весь период, знаменатель достаточно большой, чтобы процент что-то значил. */}
      {!!stats?.length && !!trend?.length && (
        <TrendChart
          title="SLA-нарушений по неделям"
          data={trend}
          managers={stats}
          metricKey="slaViolations"
          valueFormatter={(v) => `${v}`}
        />
      )}

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-5 gap-2 border-b border-rule bg-surface-sunk px-4 py-2.5">
            <SortHeader label="Менеджер" sortKeyValue="name" />
            <SortHeader label="Создано" sortKeyValue="total" hint="Всего лидов за выбранный период" />
            <SortHeader label="SLA-нарушений" sortKeyValue="slaViolations" />
            {/* "Не в сделке", не "не переведено в CRM" — лид и так уже в Bitrix CRM
                (мы читаем его оттуда же), переводится он в Сделку (STATUS_ID=CONVERTED,
                см. crm.status.list), правильная терминология важна, реальный вопрос
                пользователя 2026-09-12: "куда его ещё передавать, он уже в CRM". Числа
                пересекаются с "Провалено" (провальный лид тоже не в сделке) — hint
                вместо перестройки таблицы в три непересекающихся столбца (решение
                пользователя, "лаконично"). */}
            <SortHeader
              label="Не в сделке"
              sortKeyValue="notConvertedRate"
              hint="Не переведено в Сделку — включает и ещё не решённые, и провальные"
            />
            <SortHeader label="Провалено" sortKeyValue="junkRate" hint="Помечены Bitrix как некачественные (входит в «Не в сделке»)" />
          </div>
          {statsLoading && <p className="p-4 text-ui text-text-3">Загрузка…</p>}
          {!statsLoading &&
            sortedStats.map((m) => (
              <div key={m.assignedById} className="grid grid-cols-5 gap-2 border-b border-rule px-4 py-3 last:border-b-0">
                <span className="text-ui font-medium text-text-1">{m.name}</span>
                <span className="font-mono text-ui tabular-nums text-text-2">{m.total}</span>
                <span className="font-mono text-ui tabular-nums text-text-2">{m.slaViolations}</span>
                <span className="font-mono text-ui tabular-nums text-text-2">
                  {formatCountRate(m.total - m.converted, m.total)}
                </span>
                <span className="font-mono text-ui tabular-nums text-text-2">{formatCountRate(m.junk, m.total)}</span>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
