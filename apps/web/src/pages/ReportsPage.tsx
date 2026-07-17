import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { APPEAL_STATUS_LABELS, EMPLOYEE_APPEAL_TYPE_LABELS, type EmployeeAppealType } from "@hotline/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadReportExport, useReportSummary } from "@/hooks/api";
import { useAuthStore } from "@/lib/authStore";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function ReportsPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [from, setFrom] = useState(() => isoDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
  const [to, setTo] = useState(() => isoDate(new Date()));

  const { data } = useReportSummary("EMPLOYEE", from, to);
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

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Отчёты</h1>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="from">С</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="to">По</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {canExport && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => downloadReportExport("EMPLOYEE", from, to, "csv", canReadAuthor)}>
              <Download className="size-4" /> CSV
            </Button>
            <Button variant="outline" onClick={() => downloadReportExport("EMPLOYEE", from, to, "xlsx", canReadAuthor)}>
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
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {rows.map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="tabular-nums font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>По типам</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-sm">
              {Object.entries(data?.byType ?? {}).map(([type, count]) => (
                <li key={type} className="flex justify-between">
                  <span>{EMPLOYEE_APPEAL_TYPE_LABELS[type as EmployeeAppealType] ?? type}</span>
                  <span className="tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>По статусам</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-sm">
              {Object.entries(data?.byStatus ?? {}).map(([status, count]) => (
                <li key={status} className="flex justify-between">
                  <span>{APPEAL_STATUS_LABELS[status as keyof typeof APPEAL_STATUS_LABELS] ?? status}</span>
                  <span className="tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
