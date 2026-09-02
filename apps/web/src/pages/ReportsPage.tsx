import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { APPEAL_STATUS_LABELS } from "@hotline/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APPEAL_TYPE_LABELS } from "@/components/appeals/badges";
import { Button } from "@/components/ui/button";
import { DesktopDateRangePicker } from "@/components/ui/date-range-picker/DesktopDateRangePicker";
import { EmptyChartState } from "@/components/dashboard/EmptyChartState";
import { downloadReportExport, useReportSummary } from "@/hooks/api";
import { useAuthStore } from "@/lib/authStore";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function ReportsPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const activeChannel = useAuthStore((s) => s.activeChannel);

  // Дефолт "последние 30 дней" — тот же принцип, что и на LeadsPage/AppealsRegistryPage
  // (единственный источник для значения и для "Сбросить" у DesktopDateRangePicker).
  const resetRange = useMemo(
    () => ({ from: isoDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)), to: isoDate(new Date()) }),
    [],
  );
  const [from, setFrom] = useState(resetRange.from);
  const [to, setTo] = useState(resetRange.to);

  const { data } = useReportSummary(activeChannel, from, to);
  const canExport = hasPermission("report.export");
  const canReadAuthor = hasPermission("appeal.read_author");

  const rows = useMemo(
    () => [
      ["Создано", data?.created ?? "—"],
      ["Средняя оценка", data?.avgRating?.toFixed(2) ?? "—"],
      ["Доля низких оценок", data?.lowRatingShare !== undefined && data.lowRatingShare !== null ? `${data.lowRatingShare.toFixed(1)}%` : "—"],
      ["Повторно открыто", data?.reopenedCount ?? "—"],
      ["Backlog на конец периода", data?.backlogAtPeriodEnd ?? "—"],
    ],
    [data],
  );

  const byType = Object.entries(data?.byType ?? {});
  const byStatus = Object.entries(data?.byStatus ?? {});

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title font-bold text-text-1">Отчёты</h1>

      <div className="flex flex-wrap items-center gap-3">
        <DesktopDateRangePicker
          from={from}
          to={to}
          onChange={(f, t) => {
            setFrom(f);
            setTo(t);
          }}
          resetRange={resetRange}
        />
        {canExport && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => downloadReportExport(activeChannel, from, to, "csv", canReadAuthor)}>
              <Download className="size-4" /> CSV
            </Button>
            <Button variant="outline" onClick={() => downloadReportExport(activeChannel, from, to, "xlsx", canReadAuthor)}>
              <Download className="size-4" /> XLSX
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Показатели периода</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 text-ui">
              {rows.map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-text-3">{label}</dt>
                  <dd className="font-mono font-medium tabular-nums text-text-1">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>По типам</CardTitle>
          </CardHeader>
          <CardContent className="h-40">
            {byType.length ? (
              <ul className="flex flex-col gap-1 text-ui">
                {byType.map(([type, count]) => (
                  <li key={type} className="flex justify-between">
                    <span className="text-text-1">{APPEAL_TYPE_LABELS[type] ?? type}</span>
                    <span className="font-mono tabular-nums text-text-1">{count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyChartState label="Нет данных за период" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>По статусам</CardTitle>
          </CardHeader>
          <CardContent className="h-40">
            {byStatus.length ? (
              <ul className="flex flex-col gap-1 text-ui">
                {byStatus.map(([status, count]) => (
                  <li key={status} className="flex justify-between">
                    <span className="text-text-1">{APPEAL_STATUS_LABELS[status as keyof typeof APPEAL_STATUS_LABELS] ?? status}</span>
                    <span className="font-mono tabular-nums text-text-1">{count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyChartState label="Нет обращений за период" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
