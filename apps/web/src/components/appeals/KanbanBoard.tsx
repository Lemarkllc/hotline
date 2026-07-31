import { useState } from "react";
import { Link } from "react-router-dom";
import {
  APPEAL_STATUS_LABELS,
  APPEAL_STATUS_TRANSITIONS,
  RESIGNATION_OUTCOME_LABELS,
  type AppealStatus,
  type ResignationOutcome,
} from "@hotline/shared";
import { Card, CardContent } from "@/components/ui/card";
import { ModeBadge, TypeLabel } from "@/components/appeals/badges";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppeals, useChangeStatusAny, type AppealDTO } from "@/hooks/api";
import { useAuthStore } from "@/lib/authStore";

const COLUMNS: AppealStatus[] = ["OPEN", "UNDER_REVIEW", "IN_PROGRESS", "CLOSED"];

/** Колонки отличаются по цвету — visual cue стадии воронки (SRS не требует
 * дословно, но так быстрее читается доска: где новое, где ждёт, где в работе,
 * где закрыто). Акцент только в верхней полосе и счётчике — не в фоне карточек,
 * чтобы не конкурировать с фиолетовым маркером конфиденциальности. */
const COLUMN_STYLES: Record<AppealStatus, { border: string; badge: string }> = {
  OPEN: { border: "border-t-slate-400", badge: "bg-slate-200 text-slate-700" },
  UNDER_REVIEW: { border: "border-t-warning", badge: "bg-warning/15 text-warning" },
  IN_PROGRESS: { border: "border-t-primary", badge: "bg-primary/15 text-primary" },
  CLOSED: { border: "border-t-success", badge: "bg-success/15 text-success" },
};

function AppealCard({ appeal }: { appeal: AppealDTO }) {
  const ageDays = Math.floor((Date.now() - new Date(appeal.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  return (
    <Card
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/appeal-id", appeal.id)}
      className="cursor-grab active:cursor-grabbing"
    >
      <CardContent className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between">
          <Link to={`/appeals/${appeal.id}`} className="text-sm font-medium text-primary hover:underline">
            {appeal.publicNumber}
          </Link>
          <div className="flex items-center gap-2">
            {appeal.unreadCount > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
                {appeal.unreadCount}
              </span>
            )}
            <span className="text-xs text-muted-foreground">{ageDays} дн.</span>
          </div>
        </div>
        <TypeLabel type={appeal.type} />
        <div className="flex items-center justify-between">
          <ModeBadge mode={appeal.mode} />
          {appeal.rating &&
            // score — EMPLOYEE; wouldRecommendScore/wouldReturnScore — CUSTOMER (NPS-style,
            // Фаза 7). score===null для клиентских обращений, а "null <= 2" в JS истинно —
            // проверять надо явно на !== null, иначе ложное "Низкая оценка" на каждой
            // клиентской карточке с рейтингом.
            ((appeal.rating.score !== null && appeal.rating.score <= 2) ||
              (appeal.rating.wouldRecommendScore !== null && appeal.rating.wouldRecommendScore <= 2) ||
              (appeal.rating.wouldReturnScore !== null && appeal.rating.wouldReturnScore <= 2)) && (
              <span className="text-xs font-medium text-destructive">Низкая оценка</span>
            )}
        </div>
      </CardContent>
    </Card>
  );
}

function KanbanColumn({
  status,
  appeals,
  onDrop,
}: {
  status: AppealStatus;
  appeals: AppealDTO[];
  onDrop: (appealId: string, toStatus: AppealStatus) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const style = COLUMN_STYLES[status];
  return (
    <div
      className={`flex w-72 shrink-0 flex-col gap-3 rounded-lg border border-t-4 border-border bg-background p-3 ${style.border} ${dragOver ? "ring-2 ring-primary" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const appealId = e.dataTransfer.getData("text/appeal-id");
        if (appealId) onDrop(appealId, status);
      }}
    >
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold">{APPEAL_STATUS_LABELS[status]}</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${style.badge}`}>
          {appeals.length}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {appeals.map((a) => (
          <AppealCard key={a.id} appeal={a} />
        ))}
      </div>
    </div>
  );
}

/** Kanban — просто другое визуальное представление того же реестра обращений
 * (см. AppealsPage), не отдельный раздел с собственными данными. */
export function KanbanBoard() {
  const activeChannel = useAuthStore((s) => s.activeChannel);
  // API ограничивает pageSize максимумом 100 — для MVP-масштаба (до ~200 сотрудников)
  // этого достаточно, чтобы показать весь актуальный backlog на доске.
  const { data } = useAppeals({ channel: activeChannel, page: 1, pageSize: 100 });
  const changeStatus = useChangeStatusAny();
  const [pendingClose, setPendingClose] = useState<AppealDTO | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);

  const appealsByStatus = new Map<AppealStatus, AppealDTO[]>(COLUMNS.map((s) => [s, []]));
  for (const appeal of data?.items ?? []) {
    appealsByStatus.get(appeal.status)?.push(appeal);
  }

  function handleDrop(appealId: string, toStatus: AppealStatus) {
    const appeal = data?.items.find((a) => a.id === appealId);
    if (!appeal || appeal.status === toStatus) return;

    const allowed = APPEAL_STATUS_TRANSITIONS[appeal.status].includes(toStatus);
    if (!allowed) {
      setDropError(
        `Переход из «${APPEAL_STATUS_LABELS[appeal.status]}» в «${APPEAL_STATUS_LABELS[toStatus]}» недопустим.`,
      );
      return;
    }
    if (toStatus === "CLOSED") {
      setPendingClose(appeal);
      return;
    }
    changeStatus.mutate({ id: appealId, toStatus });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            appeals={appealsByStatus.get(status) ?? []}
            onDrop={handleDrop}
          />
        ))}
      </div>

      <Dialog open={Boolean(dropError)} onOpenChange={() => setDropError(null)}>
        <DialogContent>
          <DialogTitle>Недопустимый переход</DialogTitle>
          <DialogDescription>{dropError}</DialogDescription>
          <DialogFooter>
            <Button onClick={() => setDropError(null)}>Понятно</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CloseAppealDialog appeal={pendingClose} onClose={() => setPendingClose(null)} />
    </div>
  );
}

function CloseAppealDialog({ appeal, onClose }: { appeal: AppealDTO | null; onClose: () => void }) {
  const [finalAnswer, setFinalAnswer] = useState("");
  const [resignationOutcome, setResignationOutcome] = useState<ResignationOutcome | "">("");
  const changeStatus = useChangeStatusAny();
  const isResignation = appeal?.type === "RESIGNATION";

  async function handleSubmit() {
    if (!appeal) return;
    await changeStatus.mutateAsync({
      id: appeal.id,
      toStatus: "CLOSED",
      finalAnswer,
      resignationOutcome: resignationOutcome || undefined,
    });
    setFinalAnswer("");
    setResignationOutcome("");
    onClose();
  }

  return (
    <Dialog open={Boolean(appeal)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>Закрытие обращения</DialogTitle>
        <DialogDescription>Закрытие требует итогового ответа автору (FR-WF-005).</DialogDescription>
        <Textarea
          className="mt-4"
          rows={4}
          placeholder="Итоговый ответ..."
          value={finalAnswer}
          onChange={(e) => setFinalAnswer(e.target.value)}
        />
        {isResignation && (
          <div className="mt-4 flex flex-col gap-1">
            <Label>Исход</Label>
            <Select value={resignationOutcome} onValueChange={(v) => setResignationOutcome(v as ResignationOutcome)}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите исход" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TERMINATED">{RESIGNATION_OUTCOME_LABELS.TERMINATED}</SelectItem>
                <SelectItem value="WITHDRAWN">{RESIGNATION_OUTCOME_LABELS.WITHDRAWN}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отменить
          </Button>
          <Button
            disabled={!finalAnswer.trim() || changeStatus.isPending || (isResignation && !resignationOutcome)}
            onClick={handleSubmit}
          >
            Закрыть обращение
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
