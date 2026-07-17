import { useState } from "react";
import { Link } from "react-router-dom";
import { APPEAL_STATUS_LABELS, APPEAL_STATUS_TRANSITIONS, type AppealStatus } from "@hotline/shared";
import { Card, CardContent } from "@/components/ui/card";
import { ModeBadge, TypeLabel } from "@/components/appeals/badges";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAppeals, useChangeStatusAny, type AppealDTO } from "@/hooks/api";

const COLUMNS: AppealStatus[] = ["OPEN", "UNDER_REVIEW", "IN_PROGRESS", "CLOSED"];

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
          <span className="text-xs text-muted-foreground">{ageDays} дн.</span>
        </div>
        <TypeLabel type={appeal.type} />
        <div className="flex items-center justify-between">
          <ModeBadge mode={appeal.mode} />
          {appeal.rating && appeal.rating.score <= 2 && (
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
  return (
    <div
      className={`flex w-72 shrink-0 flex-col gap-3 rounded-lg border border-border bg-background p-3 ${dragOver ? "ring-2 ring-primary" : ""}`}
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
        <span className="text-xs text-muted-foreground">{appeals.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {appeals.map((a) => (
          <AppealCard key={a.id} appeal={a} />
        ))}
      </div>
    </div>
  );
}

export function KanbanPage() {
  // API ограничивает pageSize максимумом 100 (защита от больших выгрузок) — для MVP-масштаба
  // (до ~200 сотрудников) этого достаточно, чтобы показать весь актуальный backlog на доске.
  const { data } = useAppeals({ channel: "EMPLOYEE", page: 1, pageSize: 100 });
  const changeStatus = useChangeStatusAny();
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null);
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
      setPendingCloseId(appealId);
      return;
    }
    changeStatus.mutate({ id: appealId, toStatus });
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Kanban</h1>
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

      <CloseAppealDialog appealId={pendingCloseId} onClose={() => setPendingCloseId(null)} />
    </div>
  );
}

function CloseAppealDialog({ appealId, onClose }: { appealId: string | null; onClose: () => void }) {
  const [finalAnswer, setFinalAnswer] = useState("");
  const changeStatus = useChangeStatusAny();

  async function handleSubmit() {
    if (!appealId) return;
    await changeStatus.mutateAsync({ id: appealId, toStatus: "CLOSED", finalAnswer });
    setFinalAnswer("");
    onClose();
  }

  return (
    <Dialog open={Boolean(appealId)} onOpenChange={(open) => !open && onClose()}>
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
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отменить
          </Button>
          <Button disabled={!finalAnswer.trim() || changeStatus.isPending} onClick={handleSubmit}>
            Закрыть обращение
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
