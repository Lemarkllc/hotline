import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Inbox, KanbanSquare, List, Search, TrendingDown, X } from "lucide-react";
import { APPEAL_STATUSES, APPEAL_STATUS_LABELS } from "@hotline/shared";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { APPEAL_TYPE_LABELS, ModeBadge, StatusBadge, TypeLabel } from "@/components/appeals/badges";
import { KanbanBoard } from "@/components/appeals/KanbanBoard";
import { useAppeals } from "@/hooks/api";
import { useAuthStore } from "@/lib/authStore";
import { useIsMobile } from "@/hooks/useIsMobile";
import { MobileRegistry } from "@/components/mobile/MobileRegistry";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
type View = "list" | "kanban";

const GRID_COLS = "92px minmax(0,1fr) 152px 210px 116px minmax(0,160px) 88px";

function ViewSwitch({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div className="inline-flex gap-1 rounded-full bg-surface-sunk p-1">
      <button
        onClick={() => onChange("list")}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-1 text-ui font-medium transition-colors duration-1",
          view === "list" ? "bg-action text-action-fg" : "text-text-2 hover:text-text-1",
        )}
      >
        <List className="size-3.5" /> Список
      </button>
      <button
        onClick={() => onChange("kanban")}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-1 text-ui font-medium transition-colors duration-1",
          view === "kanban" ? "bg-action text-action-fg" : "text-text-2 hover:text-text-1",
        )}
      >
        <KanbanSquare className="size-3.5" /> Kanban
      </button>
    </div>
  );
}

/** Единый раздел "Обращения" — Kanban не отдельная сущность, а просто другое
 * визуальное представление того же реестра (запрос пользователя), поэтому
 * переключается тут же, а не отдельным пунктом меню. */
export function AppealsRegistryPage() {
  const isMobile = useIsMobile();
  const activeChannel = useAuthStore((s) => s.activeChannel);
  const [searchParams, setSearchParams] = useSearchParams();
  const view: View = searchParams.get("view") === "kanban" ? "kanban" : "list";
  const [page, setPage] = useState(1);
  // Начальные значения — из query-параметров (переходы с Dashboard: /appeals?status=CLOSED
  // и т.п.), дальше живут в локальном состоянии, не синхронизируются обратно в URL.
  // "active" (дефолт) — всё, кроме закрытых: открытый список без фильтра иначе быстро
  // заполняется закрытыми обращениями и превращается в бесполезную свалку.
  const [statusFilter, setStatusFilter] = useState<string>(() => searchParams.get("status") ?? "active");
  const status = statusFilter === "active" || statusFilter === "all" ? undefined : statusFilter;
  const excludeStatus = statusFilter === "active" ? "CLOSED" : undefined;
  const [type, setType] = useState<string | undefined>(() => searchParams.get("type") ?? undefined);
  const [search, setSearch] = useState("");
  const [backlogOnly, setBacklogOnly] = useState(() => searchParams.get("backlogOnly") === "true");
  const [lowRatingOnly, setLowRatingOnly] = useState(() => searchParams.get("lowRatingOnly") === "true");

  const { data, isLoading } = useAppeals({
    channel: activeChannel,
    page,
    pageSize: PAGE_SIZE,
    status,
    excludeStatus,
    type,
    search: search || undefined,
    backlogOnly: backlogOnly || undefined,
    lowRatingOnly: lowRatingOnly || undefined,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  function setView(v: View) {
    setSearchParams(v === "list" ? {} : { view: v });
  }

  if (isMobile) {
    return (
      <MobileRegistry
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        chip={statusFilter === "active" ? "all" : statusFilter}
        onChipChange={(v) => {
          setStatusFilter(v);
          setPage(1);
        }}
        appeals={data?.items ?? []}
        isLoading={isLoading}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-title font-bold text-text-1">Обращения</h1>
        <ViewSwitch view={view} onChange={setView} />
      </div>

      {view === "kanban" ? (
        <KanbanBoard />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-[280px]">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-3" />
              <Input
                placeholder="Поиск по номеру или тексту"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-8"
              />
            </div>
            <Select
              value={statusFilter}
              disabled={backlogOnly}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Активные</SelectItem>
                <SelectItem value="all">Все статусы</SelectItem>
                {APPEAL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {APPEAL_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={() => {
                setBacklogOnly((v) => !v);
                setPage(1);
              }}
              title="Открыто/На проверке и без назначенного менеджера"
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-ui font-medium transition-colors duration-1",
                backlogOnly ? "bg-action text-action-fg" : "bg-surface-sunk text-text-2 hover:text-text-1",
              )}
            >
              <Inbox className="size-3.5" /> Только бэклог
            </button>
            <button
              onClick={() => {
                setLowRatingOnly((v) => !v);
                setPage(1);
              }}
              title="Оценка автора 1-2"
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-ui font-medium transition-colors duration-1",
                lowRatingOnly ? "bg-action text-action-fg" : "bg-surface-sunk text-text-2 hover:text-text-1",
              )}
            >
              <TrendingDown className="size-3.5" /> Низкие оценки
            </button>
            {type && (
              <button
                onClick={() => setType(undefined)}
                className="flex items-center gap-1.5 rounded-full bg-surface-sunk px-3 py-1.5 text-ui text-text-2 hover:text-text-1"
              >
                Тип: {APPEAL_TYPE_LABELS[type] ?? type}
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border border-rule">
            <div
              className="grid min-w-[900px] border-b border-rule bg-surface-sunk"
              style={{ gridTemplateColumns: GRID_COLS }}
            >
              {["Номер", "Тема / тип", "Статус", "Режим", "Ответственный", "Оценка", "Дата"].map((h) => (
                <div key={h} className="flex h-[34px] items-center px-3 font-mono text-label font-medium uppercase tracking-wide text-text-3">
                  {h}
                </div>
              ))}
            </div>

            {isLoading && (
              <div className="divide-y divide-rule">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="flex h-row items-center px-3">
                    <div className="h-3.5 w-full animate-pulse rounded bg-surface-sunk" style={{ animationDuration: "1.1s" }} />
                  </div>
                ))}
              </div>
            )}
            {!isLoading && !data?.items.length && (
              <p className="px-4 py-10 text-center text-ui text-text-3">Обращений не найдено.</p>
            )}
            {!isLoading && Boolean(data?.items.length) && (
              <div className="divide-y divide-rule">
                {/* Вся строка — ссылка (не только номер), тем же принципом, что и
                    MobileRegistry (карточка целиком кликабельна) и LeadsPage — раньше
                    только 92px из ~900px были кликабельны, три реестра расходились в
                    этом поведении (прогон impeccable). */}
                {data!.items.map((appeal) => (
                  <Link
                    key={appeal.id}
                    to={`/appeals/${appeal.id}`}
                    className="grid h-row min-w-[900px] items-center transition-colors duration-1 hover:bg-surface-sunk/60"
                    style={{ gridTemplateColumns: GRID_COLS }}
                  >
                    <div className="flex items-center gap-1.5 px-3 font-mono text-ui tabular-nums text-text-2">
                      {appeal.publicNumber}
                      {appeal.unreadCount > 0 && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-status-overdue-tint px-1 font-mono text-[10px] font-semibold text-status-overdue">
                          {appeal.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 truncate px-3">
                      <TypeLabel type={appeal.type} />
                    </div>
                    <div className="px-3">
                      <StatusBadge status={appeal.status} />
                    </div>
                    <div className="px-3">
                      <ModeBadge mode={appeal.mode} />
                    </div>
                    <div className="truncate px-3 text-ui text-text-2">
                      {appeal.assignees.map((a) => a.fullName).join(", ") || "—"}
                    </div>
                    <div className="px-3 font-mono text-ui tabular-nums text-text-2">{appeal.rating?.score ?? "—"}</div>
                    <div className="px-3 font-mono text-meta tabular-nums text-text-3">
                      {new Date(appeal.createdAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

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
        </>
      )}
    </div>
  );
}
