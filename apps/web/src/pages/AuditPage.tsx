import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuditLog } from "@/hooks/api";

/** SRS §37 — журнал аудита, append-only. */
export function AuditPage() {
  const [action, setAction] = useState("");
  const { data } = useAuditLog({ action: action || undefined });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Аудит</h1>
      <Input
        placeholder="Фильтр по действию, например appeal.view_confidential_author"
        value={action}
        onChange={(e) => setAction(e.target.value)}
        className="max-w-md"
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Время</TableHead>
            <TableHead>Действие</TableHead>
            <TableHead>Объект</TableHead>
            <TableHead>Результат</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="tabular-nums">{new Date(entry.createdAt).toLocaleString("ru-RU")}</TableCell>
              <TableCell>{entry.action}</TableCell>
              <TableCell className="text-muted-foreground">
                {entry.objectType} {entry.objectId?.slice(0, 8)}
              </TableCell>
              <TableCell>{entry.result}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
