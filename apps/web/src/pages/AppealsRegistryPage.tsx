import { useState } from "react";
import { Link } from "react-router-dom";
import { APPEAL_STATUSES, APPEAL_STATUS_LABELS } from "@hotline/shared";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ModeBadge, StatusBadge, TypeLabel } from "@/components/appeals/badges";
import { useAppeals } from "@/hooks/api";

const PAGE_SIZE = 20;

export function AppealsRegistryPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useAppeals({
    channel: "EMPLOYEE",
    page,
    pageSize: PAGE_SIZE,
    status,
    search: search || undefined,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Реестр обращений</h1>
      </div>

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
          value={status ?? "all"}
          onValueChange={(v) => {
            setStatus(v === "all" ? undefined : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            {APPEAL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {APPEAL_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                <Link to={`/appeals/${appeal.id}`} className="font-medium text-primary hover:underline">
                  {appeal.publicNumber}
                </Link>
              </TableCell>
              <TableCell className="tabular-nums">{new Date(appeal.createdAt).toLocaleDateString("ru-RU")}</TableCell>
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
    </div>
  );
}
