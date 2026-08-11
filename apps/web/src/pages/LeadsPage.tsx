import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, FilePlus2, Percent, ShieldOff, Sparkles, Target } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@hotline/shared";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DesktopDateRangePicker } from "@/components/ui/date-range-picker/DesktopDateRangePicker";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { useLeadConversionStats, useLeadDailyStats, useLeads, type LeadsView } from "@/hooks/api";
import { useLeadsRealtime } from "@/lib/realtimeLeads";
import { useIsMobile } from "@/hooks/useIsMobile";
import { MobileLeadsRegistry } from "@/components/mobile/MobileLeadsRegistry";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const VIEW_LABELS: Record<LeadsView, string> = {
  active: "Активные",
  converted: "Переданные в CRM",
  stop_listed: "Стоп-лист",
};

const VIEW_EMPTY_MESSAGES: Record<LeadsView, string> = {
  active: "Активных заявок нет.",
  converted: "Ни одна заявка ещё не передана в CRM.",
  stop_listed: "Стоп-лист пуст.",
};

const STATUS_VARIANT: Record<LeadStatus, BadgeProps["variant"]> = {
  NEW: "default",
  IN_PROGRESS: "warning",
  CONVERTED: "success",
  STOP_LISTED: "destructive",
};

function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{LEAD_STATUS_LABELS[status]}</Badge>;
}

/** «Заявки» — email-лиды с sales@lemarkllc.ru, независимый от «Обращения»/CUSTOMER-
 * канала раздел (см. PLAN.md "«Заявки» — email-лиды..."). */
export function LeadsPage() {
  useLeadsRealtime();
  const isMobile = useIsMobile();
  const [view, setView] = useState<LeadsView>("active");
  const { data: leads, isLoading } = useLeads(view);

  // Дефолт "последние 30 дней" — единственный источник для обеих версий (десктоп/PWA)
  // и для "Сбросить" у DateRangePicker (см. resetRange ниже) — компонент сам этого
  // значения не знает, чтобы оставаться переиспользуемым для других дефолтов.
  const resetRange = useMemo(
    () => ({ from: isoDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)), to: isoDate(new Date()) }),
    [],
  );
  const [from, setFrom] = useState(resetRange.from);
  const [to, setTo] = useState(resetRange.to);
  const { data: stats } = useLeadConversionStats(from, to);
  // График "по дням" только на десктопе (см. MobileLeadsRegistry) — на телефоне
  // запрос не нужен, не гоняем его зря.
  const { data: dailyStats } = useLeadDailyStats(from, to, !isMobile);

  if (isMobile) {
    return (
      <MobileLeadsRegistry
        view={view}
        onViewChange={setView}
        leads={leads ?? []}
        isLoading={isLoading}
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        stats={stats}
        resetRange={resetRange}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Заявки</h1>
          <p className="text-sm text-muted-foreground">Email-лиды с sales@lemarkllc.ru</p>
        </div>
        {/* В одной строке с заголовком, а не отдельным широким блоком — тот же фильтр
            "выше того, что фильтрует" (плитки/график), просто визуально легче. */}
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

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Всего заявок" value={stats?.total ?? "—"} icon={FilePlus2} accent="slate" />
        <KpiCard label="Передано в CRM" value={stats?.converted ?? "—"} icon={Target} accent="success" />
        <KpiCard
          label="Конверсия"
          value={stats?.conversionRate !== null && stats?.conversionRate !== undefined ? `${stats.conversionRate.toFixed(0)}%` : "—"}
          icon={Percent}
          accent="primary"
        />
        <KpiCard label="Качественных (ИИ)" value={stats?.aiRelevant ?? "—"} icon={Sparkles} accent="warning" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Качественные лиды по дням</CardTitle>
        </CardHeader>
        <CardContent className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyStats ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(d: string) => new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip
                labelFormatter={(d: string) => new Date(d).toLocaleDateString("ru-RU")}
                formatter={(value: number) => [value, "Качественных"]}
              />
              <Bar dataKey="aiRelevant" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button variant={view === "active" ? "default" : "outline"} size="sm" onClick={() => setView("active")}>
          {VIEW_LABELS.active}
        </Button>
        <Button variant={view === "converted" ? "default" : "outline"} size="sm" onClick={() => setView("converted")}>
          <Target className="size-4" /> {VIEW_LABELS.converted}
        </Button>
        <Button variant={view === "stop_listed" ? "default" : "outline"} size="sm" onClick={() => setView("stop_listed")}>
          <ShieldOff className="size-4" /> {VIEW_LABELS.stop_listed}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Номер</TableHead>
            <TableHead>Дата</TableHead>
            <TableHead>Отправитель</TableHead>
            <TableHead>Тема</TableHead>
            <TableHead>Статус</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Загрузка...
              </TableCell>
            </TableRow>
          )}
          {!isLoading && !leads?.length && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                {VIEW_EMPTY_MESSAGES[view]}
              </TableCell>
            </TableRow>
          )}
          {leads?.map((lead) => (
            <TableRow key={lead.id}>
              <TableCell>
                <Link to={`/leads/${lead.id}`} className="font-medium text-primary hover:underline">
                  {lead.publicNumber}
                </Link>
              </TableCell>
              <TableCell className="tabular-nums">{new Date(lead.createdAt).toLocaleDateString("ru-RU")}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span>{lead.fromName ?? lead.fromEmail}</span>
                  {lead.fromName && <span className="text-xs text-muted-foreground">{lead.fromEmail}</span>}
                </div>
              </TableCell>
              <TableCell className="max-w-xs truncate">{lead.subject}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <LeadStatusBadge status={lead.status} />
                  {lead.aiIsRelevant === true && (
                    <span title={lead.aiReasoning ?? "ИИ считает релевантным"}>
                      <CheckCircle2 className="size-4 text-emerald-500" aria-label="ИИ считает релевантным" />
                    </span>
                  )}
                  {lead.aiIsRelevant === false && (
                    <span title={lead.aiReasoning ?? "ИИ считает нерелевантным"}>
                      <AlertTriangle className="size-4 text-amber-500" aria-label="ИИ считает нерелевантным" />
                    </span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
