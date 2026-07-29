import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Inbox, KanbanSquare, List, TrendingDown, X } from "lucide-react";
import {
  APPEAL_STATUSES,
  APPEAL_STATUS_LABELS,
  EMPLOYEE_APPEAL_TYPE_LABELS,
  type EmployeeAppealType,
} from "@hotline/shared";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ModeBadge, StatusBadge, TypeLabel } from "@/components/appeals/badges";
import { KanbanBoard } from "@/components/appeals/KanbanBoard";
import { useAppeals } from "@/hooks/api";

const PAGE_SIZE = 20;
type View = "list" | "kanban";

function ViewSwitch({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div className="inline-flex rounded-md border border-border bg-surface p-1">
      <Button variant={view === "list" ? "default" : "ghost"} size="sm" onClick={() => onChange("list")}>
        <List className="size-4" /> Список
      </Button>
      <Button variant={view === "kanban" ? "default" : "ghost"} size="sm" onClick={() => onChange("kanban")}>
        <KanbanSquare className="size-4" /> Kanban
      </Button>
    </div>
  );
}

/** Единый раздел "Обращения" — Kanban не отдельная сущность, а просто другое
 * визуальное представление того же реестра (запрос пользователя), поэтому
 * переключается тут же, а не отдельным пунктом меню. */
export function AppealsRegistryPage() {
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
    channel: "EMPLOYEE",
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Обращения</h1>
        <ViewSwitch view={view} onChange={setView} />
      </div>

      {view === "kanban" ? (
        <KanbanBoard />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Поиск по номеру или тексту"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="max-w-xs"
            />
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
                <SelectItem value="active">Активные (кроме закрытых)</SelectItem>
                <SelectItem value="all">Все статусы</SelectItem>
                {APPEAL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {APPEAL_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={backlogOnly ? "default" : "outline"}
              size="sm"
              title="Открыто/На проверке и без назначенного менеджера"
              onClick={() => {
                setBacklogOnly((v) => !v);
                setPage(1);
              }}
            >
              <Inbox className="size-4" /> Только бэклог
            </Button>
            <Button
              variant={lowRatingOnly ? "default" : "outline"}
              size="sm"
              title="Оценка автора 1-2"
              onClick={() => {
                setLowRatingOnly((v) => !v);
                setPage(1);
              }}
            >
              <TrendingDown className="size-4" /> Низкие оценки
            </Button>
            {type && (
              <button
                onClick={() => setType(undefined)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-background"
              >
                Тип: {EMPLOYEE_APPEAL_TYPE_LABELS[type as EmployeeAppealType] ?? type}
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Номер</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Режим</TableHead>
                <TableHead>Ответственный</TableHead>
                <TableHead>Оценка</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !data?.items.length && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Обращений не найдено.
                  </TableCell>
                </TableRow>
              )}
              {data?.items.map((appeal) => (
                <TableRow key={appeal.id}>
                  <TableCell>
                    <Link
                      to={`/appeals/${appeal.id}`}
                      className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
                    >
                      {appeal.publicNumber}
                      {appeal.unreadCount > 0 && (
                        <span className="flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
                          {appeal.unreadCount}
                        </span>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {new Date(appeal.createdAt).toLocaleDateString("ru-RU")}
                  </TableCell>
                  <TableCell>
                    <TypeLabel type={appeal.type} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={appeal.status} />
                  </TableCell>
                  <TableCell>
                    <ModeBadge mode={appeal.mode} />
                  </TableCell>
                  <TableCell>{appeal.assignees.map((a) => a.fullName).join(", ") || "—"}</TableCell>
                  <TableCell className="tabular-nums">{appeal.rating?.score ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Стр. {page} из {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Назад
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Вперёд
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
