import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  FilePlus2,
  Percent,
  Search,
  ShieldOff,
  Sparkles,
  Target,
  UserCheck,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@hotline/shared";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DesktopDateRangePicker } from "@/components/ui/date-range-picker/DesktopDateRangePicker";
import { KpiCard } from "@/components/dashboard/KpiCard";
import {
  useBulkAssignLeads,
  useBulkStopListLeads,
  useBulkTakeInProgressLeads,
  useLeadAssignableUsers,
  useLeadConversionStats,
  useLeadDailyStats,
  useLeads,
  type LeadDTO,
  type LeadsView,
} from "@/hooks/api";
import { useAuthStore } from "@/lib/authStore";
import { useLeadsRealtime } from "@/lib/realtimeLeads";
import { useIsMobile } from "@/hooks/useIsMobile";
import { MobileLeadsRegistry } from "@/components/mobile/MobileLeadsRegistry";
import { cn } from "@/lib/utils";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const VIEW_LABELS: Record<LeadsView, string> = {
  active: "Активные",
  converted: "Переданные в CRM",
  stop_listed: "Стоп-лист",
};

const VIEW_EMPTY_MESSAGES: Record<LeadsView, string> = {
  active: "Новых заявок нет — новые письма появятся автоматически.",
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

/** SLA — не поле в БД, а вычисление из firstResponseDueAt/firstRespondedAt (leadService),
 * тем же принципом, что и на карточке лида (LeadDetailPage). Только для активных заявок —
 * переданные в CRM/стоп-лист не могут быть "просрочены". */
function isOverdue(lead: LeadDTO): boolean {
  if (lead.status !== "NEW" && lead.status !== "IN_PROGRESS") return false;
  if (lead.firstRespondedAt) return false;
  return new Date(lead.firstResponseDueAt).getTime() < Date.now();
}

type ChipFilter = "all" | "mine" | "unassigned" | "overdue";
const CHIP_LABELS: Record<ChipFilter, string> = {
  all: "Все",
  mine: "Мои",
  unassigned: "Без ответственного",
  overdue: "Просроченные",
};

/** «Заявки» — email-лиды с sales@lemarkllc.ru, независимый от «Обращения»/CUSTOMER-
 * канала раздел (см. PLAN.md "«Заявки» — email-лиды..."). */
export function LeadsPage() {
  useLeadsRealtime();
  const isMobile = useIsMobile();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [view, setView] = useState<LeadsView>("active");
  const [chip, setChip] = useState<ChipFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignTargetId, setAssignTargetId] = useState("");

  // Дефолт "последние 30 дней" — единственный источник для обеих версий (десктоп/PWA)
  // и для "Сбросить" у DateRangePicker (см. resetRange ниже) — компонент сам этого
  // значения не знает, чтобы оставаться переиспользуемым для других дефолтов.
  const resetRange = useMemo(
    () => ({ from: isoDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)), to: isoDate(new Date()) }),
    [],
  );
  const [from, setFrom] = useState(resetRange.from);
  const [to, setTo] = useState(resetRange.to);
  const { data: leads, isLoading, isError: leadsError, refetch: refetchLeads } = useLeads(view, from, to);
  const { data: stats, isError: statsError } = useLeadConversionStats(from, to);
  // График "по дням" только на десктопе (см. MobileLeadsRegistry) — на телефоне
  // запрос не нужен, не гоняем его зря.
  const { data: dailyStats } = useLeadDailyStats(from, to, !isMobile);
  const { data: assignableUsers } = useLeadAssignableUsers(view === "active");
  const bulkStopList = useBulkStopListLeads();
  const bulkTakeInProgress = useBulkTakeInProgressLeads();
  const bulkAssign = useBulkAssignLeads();

  const maxDaily = Math.max(1, ...(dailyStats ?? []).map((d) => d.aiRelevant));
  const yTicks = useMemo(() => Array.from({ length: maxDaily + 1 }, (_, i) => i), [maxDaily]);

  const filteredLeads = useMemo(() => {
    let rows = leads ?? [];
    if (view === "active") {
      if (chip === "mine") rows = rows.filter((l) => l.assignee?.id === currentUserId);
      else if (chip === "unassigned") rows = rows.filter((l) => !l.assignee);
      else if (chip === "overdue") rows = rows.filter(isOverdue);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (l) =>
          l.subject.toLowerCase().includes(q) ||
          l.fromEmail.toLowerCase().includes(q) ||
          (l.fromName?.toLowerCase().includes(q) ?? false) ||
          l.publicNumber.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [leads, view, chip, search, currentUserId]);

  const overdueCount = (leads ?? []).filter(isOverdue).length;
  const unassignedCount = (leads ?? []).filter((l) => !l.assignee).length;

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkStopList() {
    const reason = window.prompt("Причина (спам / нецелевое обращение):") ?? undefined;
    await bulkStopList.mutateAsync({ ids: [...selectedIds], reason });
    setSelectedIds(new Set());
  }

  async function handleBulkTakeInProgress() {
    await bulkTakeInProgress.mutateAsync([...selectedIds]);
    setSelectedIds(new Set());
  }

  async function handleBulkAssign() {
    if (!assignTargetId) return;
    await bulkAssign.mutateAsync({ ids: [...selectedIds], userId: assignTargetId });
    setSelectedIds(new Set());
    setAssignTargetId("");
  }

  if (isMobile) {
    return (
      <MobileLeadsRegistry
        view={view}
        onViewChange={setView}
        leads={leads ?? []}
        isLoading={isLoading}
        isError={leadsError}
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
    <div className="flex flex-col gap-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title font-bold text-text-1">Заявки</h1>
          <p className="mt-0.5 font-mono text-meta text-text-3">
            {leads?.length ?? 0} активных · {unassignedCount} без ответственного · {overdueCount} просрочено
          </p>
        </div>
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
          Не удалось загрузить статистику за период.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Всего заявок" value={stats?.total ?? "—"} icon={FilePlus2} accent="neutral" />
        <KpiCard label="Передано в CRM" value={stats?.converted ?? "—"} icon={Target} accent="closed" />
        <KpiCard
          label="Конверсия"
          value={stats?.conversionRate !== null && stats?.conversionRate !== undefined ? `${stats.conversionRate.toFixed(0)}%` : "—"}
          icon={Percent}
          accent="progress"
        />
        <KpiCard label="Качественных (ИИ)" value={stats?.aiRelevant ?? "—"} icon={Sparkles} accent="review" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Качественные лиды по дням</CardTitle>
        </CardHeader>
        <CardContent className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyStats ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DD" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(d: string) => new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}
              />
              {/* Явные целые тики от максимума данных — иначе Recharts сам подбирает
                  "красивые" числа и на маленьких значениях промахивается неровно. */}
              <YAxis allowDecimals={false} ticks={yTicks} domain={[0, maxDaily]} tick={{ fontSize: 12 }} />
              <Tooltip
                labelFormatter={(d: string) => new Date(d).toLocaleDateString("ru-RU")}
                formatter={(value: number) => [value, "Качественных"]}
              />
              {/* Буквальный hex статуса "В работе" (status-review, tokens.css) — Recharts
                  принимает только строку цвета, не Tailwind-класс. */}
              <Bar dataKey="aiRelevant" fill="#96631A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(Object.keys(VIEW_LABELS) as LeadsView[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setView(v);
                setChip("all");
                setSelectedIds(new Set());
              }}
              className={cn(
                "rounded-full px-3 py-1.5 text-ui font-medium transition-colors duration-1",
                view === v ? "bg-action text-action-fg" : "text-text-2 hover:bg-surface-sunk",
              )}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
        <div className="relative w-[280px]">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-3" />
          <Input
            placeholder="Поиск по теме, имени, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {view === "active" && (
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CHIP_LABELS) as ChipFilter[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChip(c)}
              className={cn(
                "rounded-full px-3 py-1 text-meta font-medium transition-colors duration-1",
                chip === c ? "bg-action text-action-fg" : "bg-surface-sunk text-text-2 hover:text-text-1",
              )}
            >
              {CHIP_LABELS[c]}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-rule">
        <div
          className="grid min-w-[900px] items-center gap-0 border-b border-rule bg-surface-sunk"
          style={{ gridTemplateColumns: `40px 92px minmax(0,1fr) 116px 150px 132px 96px` }}
        >
          {view === "active" && (
            <div className="flex h-[34px] items-center justify-center">
              <input
                type="checkbox"
                aria-label="Выбрать все"
                checked={Boolean(filteredLeads.length) && selectedIds.size === filteredLeads.length}
                onChange={(e) => setSelectedIds(e.target.checked ? new Set(filteredLeads.map((l) => l.id)) : new Set())}
              />
            </div>
          )}
          {["Номер", "Тема", "Источник", "Ответственный", "Статус", "Обновлено"].map((h) => (
            <div key={h} className="flex h-[34px] items-center px-3 font-mono text-label font-medium uppercase tracking-wide text-text-3">
              {h}
            </div>
          ))}
        </div>

        {leadsError && (
          <p className="px-4 py-6 text-center text-ui text-status-overdue">
            Не удалось загрузить заявки.{" "}
            <button type="button" className="underline" onClick={() => refetchLeads()}>
              Повторить
            </button>
          </p>
        )}
        {!leadsError && isLoading && (
          <div className="divide-y divide-rule">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex h-row items-center gap-3 px-3">
                <div className="h-3.5 w-full animate-pulse rounded bg-surface-sunk" style={{ animationDuration: "1.1s" }} />
              </div>
            ))}
          </div>
        )}
        {!leadsError && !isLoading && !filteredLeads.length && (
          <p className="px-4 py-10 text-center text-ui text-text-3">{VIEW_EMPTY_MESSAGES[view]}</p>
        )}
        {!leadsError && !isLoading && (
          <div className="divide-y divide-rule">
            {filteredLeads.map((lead) => {
              const overdue = isOverdue(lead);
              return (
                <div
                  key={lead.id}
                  className={cn(
                    "grid h-row min-w-[900px] items-center",
                    selectedIds.has(lead.id) && "bg-surface-sunk",
                  )}
                  style={{ gridTemplateColumns: `40px 92px minmax(0,1fr) 116px 150px 132px 96px` }}
                >
                  {view === "active" && (
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        aria-label={`Выбрать ${lead.publicNumber}`}
                        checked={selectedIds.has(lead.id)}
                        onChange={() => toggleSelected(lead.id)}
                      />
                    </div>
                  )}
                  <div className="px-3 font-mono text-ui tabular-nums text-text-2">
                    <Link to={`/leads/${lead.id}`} className="hover:text-text-1 hover:underline">
                      {lead.publicNumber}
                    </Link>
                  </div>
                  <div className="flex min-w-0 items-center gap-2 px-3">
                    <Link to={`/leads/${lead.id}`} className="truncate text-ui font-medium text-text-1 hover:underline">
                      {lead.subject}
                    </Link>
                    {lead.aiIsRelevant === true && (
                      <span title={lead.aiReasoning ?? "ИИ считает релевантным"}>
                        <CheckCircle2 className="size-3.5 shrink-0 text-status-closed" />
                      </span>
                    )}
                    {lead.aiIsRelevant === false && (
                      <span title={lead.aiReasoning ?? "ИИ считает нерелевантным"}>
                        <AlertTriangle className="size-3.5 shrink-0 text-status-review" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 px-3 text-ui text-text-2">
                    <span className="size-1.5 rounded-full bg-text-3" /> Почта
                  </div>
                  <div className="truncate px-3 text-ui">
                    {lead.assignee ? (
                      <span className="text-text-1">{lead.assignee.fullName}</span>
                    ) : (
                      <span className="font-medium text-status-review">Не назначен</span>
                    )}
                  </div>
                  <div className="px-3">
                    {overdue ? <Badge variant="destructive">Просрочена</Badge> : <LeadStatusBadge status={lead.status} />}
                  </div>
                  <div className={cn("px-3 font-mono text-meta tabular-nums", overdue ? "font-medium text-status-overdue" : "text-text-3")}>
                    {new Date(lead.updatedAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Плавающая панель массовых действий — border-radius 100px, не сдвигает шапку
       * таблицы, остаётся видимой при прокрутке (design_handoff_lemark_one/Leads.dc.html). */}
      {view === "active" && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-rule bg-surface px-3 py-2 shadow-3">
          <span className="px-2 font-mono text-meta tabular-nums text-text-2">Выбрано: {selectedIds.size}</span>
          <select
            value={assignTargetId}
            onChange={(e) => setAssignTargetId(e.target.value)}
            className="h-8 rounded-full border border-rule-strong bg-surface px-2 text-meta text-text-1"
          >
            <option value="">Назначить…</option>
            {assignableUsers?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" className="rounded-full" disabled={!assignTargetId || bulkAssign.isPending} onClick={handleBulkAssign}>
            <UserCheck className="size-3.5" /> Назначить
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" disabled={bulkStopList.isPending} onClick={handleBulkStopList}>
            <ShieldOff className="size-3.5" /> В стоп-лист
          </Button>
          <Button size="sm" className="rounded-full" disabled={bulkTakeInProgress.isPending} onClick={handleBulkTakeInProgress}>
            Взять в работу
          </Button>
        </div>
      )}
    </div>
  );
}
