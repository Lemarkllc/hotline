import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@hotline/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  useConvertLeadToCrm,
  useLead,
  useSearchBitrixUsers,
  useStopListLead,
  useTakeLeadInProgress,
} from "@/hooks/api";

const STATUS_VARIANT: Record<LeadStatus, BadgeProps["variant"]> = {
  NEW: "default",
  IN_PROGRESS: "warning",
  CONVERTED: "success",
  STOP_LISTED: "destructive",
};

function ConvertToCrmDialog({ leadId, open, onClose }: { leadId: string; open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: users, isLoading } = useSearchBitrixUsers(query, open && query.trim().length >= 2);
  const convert = useConvertLeadToCrm(leadId);

  async function handleConfirm() {
    if (!selectedId) return;
    await convert.mutateAsync(selectedId);
    onClose();
    setQuery("");
    setSelectedId(null);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogTitle>Передать в CRM</DialogTitle>
        <DialogDescription>Найдите ответственного в Bitrix24 — источником лида будет указана почта.</DialogDescription>
        <Input
          className="mt-4"
          placeholder="Имя или email сотрудника Bitrix24..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedId(null);
          }}
        />
        <div className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto">
          {isLoading && <p className="text-sm text-muted-foreground">Поиск...</p>}
          {!isLoading && query.trim().length >= 2 && !users?.length && (
            <p className="text-sm text-muted-foreground">Никого не нашлось.</p>
          )}
          {users?.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setSelectedId(u.id)}
              className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                selectedId === u.id ? "border-primary bg-primary/10" : "border-border hover:bg-background"
              }`}
            >
              <div className="font-medium">{u.fullName}</div>
              {u.email && <div className="text-xs text-muted-foreground">{u.email}</div>}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отменить
          </Button>
          <Button disabled={!selectedId || convert.isPending} onClick={handleConfirm}>
            Передать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LeadDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data: lead, isLoading } = useLead(id);
  const takeInProgress = useTakeLeadInProgress(id);
  const stopList = useStopListLead(id);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);

  if (isLoading || !lead) {
    return <p className="text-muted-foreground">Загрузка...</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={() => navigate("/leads")}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> К заявкам
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{lead.publicNumber}</h1>
          <div className="mt-1">
            <Badge variant={STATUS_VARIANT[lead.status]}>{LEAD_STATUS_LABELS[lead.status]}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {lead.status === "NEW" && (
            <Button size="sm" disabled={takeInProgress.isPending} onClick={() => takeInProgress.mutate()}>
              Взять в работу
            </Button>
          )}
          {lead.status === "IN_PROGRESS" && (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={stopList.isPending}
                onClick={() => {
                  const reason = window.prompt("Причина (спам / нецелевое обращение):") ?? undefined;
                  stopList.mutate(reason);
                }}
              >
                В стоп-лист
              </Button>
              <Button size="sm" onClick={() => setConvertDialogOpen(true)}>
                Передать в CRM
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2 p-5 text-sm">
          <div>
            <span className="text-muted-foreground">Email: </span>
            {lead.fromEmail}
          </div>
          {lead.fromName && (
            <div>
              <span className="text-muted-foreground">Имя: </span>
              {lead.fromName}
            </div>
          )}
          {lead.extractedPhone && (
            <div>
              <span className="text-muted-foreground">Телефон: </span>
              {lead.extractedPhone}
            </div>
          )}
          {lead.status === "CONVERTED" && lead.bitrixLeadId && (
            <div>
              <span className="text-muted-foreground">Лид Bitrix24: </span>#{lead.bitrixLeadId}
            </div>
          )}
          {lead.status === "STOP_LISTED" && lead.stopListReason && (
            <div>
              <span className="text-muted-foreground">Причина стоп-листа: </span>
              {lead.stopListReason}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {lead.messages.map((m) => (
          <Card key={m.id}>
            <CardContent className="flex flex-col gap-1 p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{m.fromEmail}</span>
                <span>{new Date(m.receivedAt).toLocaleString("ru-RU")}</span>
              </div>
              <div className="text-sm font-medium">{m.subject}</div>
              <div className="whitespace-pre-wrap text-sm">{m.body}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ConvertToCrmDialog leadId={id} open={convertDialogOpen} onClose={() => setConvertDialogOpen(false)} />
    </div>
  );
}
