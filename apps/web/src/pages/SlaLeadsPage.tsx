import { useMemo, useState } from "react";
import { ExternalLink, ListTree, TimerReset } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { useStalledBitrixLeads, type StalledLeadDTO } from "@/hooks/api";

const PAGE_SIZE = 20;

type StatusFilter = "ALL" | "NEW" | "IN_PROCESS";

/** Часы -> "N дн M ч" (>=24ч) или "N ч M мин" — тот же принцип округления, что и
 * SlaBlock на карточке email-лида (LeadDetailPage.tsx), просто по часам, не по дате. */
function formatStale(hours: number): string {
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const restHours = Math.floor(hours % 24);
    return `${days} дн ${restHours} ч`;
  }
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  return `${wholeHours} ч ${minutes} мин`;
}

function StalledLeadRow({ lead }: { lead: StalledLeadDTO }) {
  return (
    <a
      href={lead.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-4 border-b border-rule px-4 py-3 last:border-b-0 hover:bg-surface-sunk"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-ui font-medium text-text-1">{lead.title}</p>
        <p className="mt-0.5 text-meta text-text-3">{lead.assigneeName}</p>
      </div>
      <Badge variant={lead.statusId === "NEW" ? "destructive" : "warning"}>{lead.statusLabel}</Badge>
      <span className="w-24 shrink-0 text-right font-mono text-meta tabular-nums text-status-overdue">
        {formatStale(lead.hoursStale)}
      </span>
      <ExternalLink className="size-4 shrink-0 text-text-3" />
    </a>
  );
}

/** «SLA Лиды» — зависшие лиды Bitrix24 (grill-me допрос 2026-09-12), отдельная от
 * «Заявок» (EmailLead) подсистема: данные всегда живые (crm.lead.list), своего снимка
 * нет. Плитки сверху — одновременно и агрегаты, и фильтр (клик переключает список,
 * решение пользователя 2026-09-12) — пагинация 20 строк/страница на клиенте, весь
 * список и так уже загружен целиком одним запросом. */
export function SlaLeadsPage() {
  const { data: leads, isLoading, isError } = useStalledBitrixLeads();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);

  const newCount = (leads ?? []).filter((l) => l.statusId === "NEW").length;
  const inProcessCount = (leads ?? []).filter((l) => l.statusId === "IN_PROCESS").length;

  function selectFilter(filter: StatusFilter) {
    setStatusFilter(filter);
    setPage(1);
  }

  const sortedFiltered = useMemo(() => {
    const rows = (leads ?? []).filter((l) => statusFilter === "ALL" || l.statusId === statusFilter);
    return [...rows].sort((a, b) => b.hoursStale - a.hoursStale);
  }, [leads, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / PAGE_SIZE));
  const pageRows = sortedFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6 pb-20">
      <div>
        <h1 className="text-title font-bold text-text-1">SLA Лиды</h1>
        <p className="mt-0.5 font-mono text-meta text-text-3">Зависшие лиды Bitrix24 — «Не обработан» {">"}4ч, «В работе» {">"}3 дня</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <KpiCard
          label="Всего зависших"
          value={leads?.length ?? "—"}
          icon={TimerReset}
          accent="overdue"
          onClick={() => selectFilter("ALL")}
          active={statusFilter === "ALL"}
        />
        <KpiCard
          label="«Не обработан»"
          value={newCount}
          icon={ListTree}
          accent="overdue"
          onClick={() => selectFilter("NEW")}
          active={statusFilter === "NEW"}
        />
        <KpiCard
          label="«В работе»"
          value={inProcessCount}
          icon={ListTree}
          accent="review"
          onClick={() => selectFilter("IN_PROCESS")}
          active={statusFilter === "IN_PROCESS"}
        />
      </div>

      <Card>
        {isError && <p className="p-4 text-ui text-status-overdue">Не удалось загрузить данные из Bitrix24.</p>}
        {!isError && isLoading && <p className="p-4 text-ui text-text-3">Загрузка…</p>}
        {!isError && !isLoading && !sortedFiltered.length && (
          <p className="p-4 text-ui text-text-3">
            {statusFilter === "ALL" ? "Зависших лидов нет — все в пределах SLA." : "По этому фильтру зависших лидов нет."}
          </p>
        )}
        {!isError && !!sortedFiltered.length && (
          <CardContent className="p-0">
            {pageRows.map((lead) => (
              <StalledLeadRow key={lead.id} lead={lead} />
            ))}
          </CardContent>
        )}
      </Card>

      {!isError && sortedFiltered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="font-mono text-meta text-text-3">
            Стр. {page} из {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Назад
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Вперёд
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
