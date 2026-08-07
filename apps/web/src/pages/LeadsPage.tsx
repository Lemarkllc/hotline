import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FilePlus2, Percent, ShieldOff, Target } from "lucide-react";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@hotline/shared";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { useLeadConversionStats, useLeads, type LeadsView } from "@/hooks/api";
import { useLeadsRealtime } from "@/lib/realtimeLeads";

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
  const [view, setView] = useState<LeadsView>("active");
  const { data: leads, isLoading } = useLeads(view);

  const { from, to } = useMemo(() => {
    const now = new Date();
    const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { from: past.toISOString(), to: now.toISOString() };
  }, []);
  const { data: stats } = useLeadConversionStats(from, to);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Заявки</h1>
          <p className="text-sm text-muted-foreground">Email-лиды с sales@lemarkllc.ru за последние 30 дней</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <KpiCard label="Всего заявок" value={stats?.total ?? "—"} icon={FilePlus2} accent="slate" />
        <KpiCard label="Передано в CRM" value={stats?.converted ?? "—"} icon={Target} accent="success" />
        <KpiCard
          label="Конверсия"
          value={stats?.conversionRate !== null && stats?.conversionRate !== undefined ? `${stats.conversionRate.toFixed(0)}%` : "—"}
          icon={Percent}
          accent="primary"
        />
      </div>

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
                <LeadStatusBadge status={lead.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
