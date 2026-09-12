import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock } from "lucide-react";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@hotline/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ReasonDialog } from "@/components/ui/reason-dialog";
import { AttachmentGallery } from "@/components/attachments/AttachmentGallery";
import { MobileLeadDetail } from "@/components/mobile/MobileLeadDetail";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useLeadsRealtime } from "@/lib/realtimeLeads";
import {
  fetchLeadAttachmentUrl,
  useConvertLeadToCrm,
  useLead,
  useReplyToLead,
  useRestoreLead,
  useSearchBitrixUsers,
  useStopListLead,
} from "@/hooks/api";
import { cn } from "@/lib/utils";

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
          aria-label="Поиск сотрудника Bitrix24"
          placeholder="Имя или email сотрудника Bitrix24..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedId(null);
          }}
        />
        <div className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto">
          {isLoading && <p className="text-meta text-text-3">Поиск...</p>}
          {!isLoading && query.trim().length >= 2 && !users?.length && (
            <p className="text-meta text-text-3">Никого не нашлось.</p>
          )}
          {users?.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setSelectedId(u.id)}
              className={cn(
                "rounded-md border px-3 py-2 text-left text-ui transition-colors duration-1",
                selectedId === u.id ? "border-text-1 bg-surface-sunk" : "border-rule hover:bg-surface-sunk",
              )}
            >
              <div className="font-medium text-text-1">{u.fullName}</div>
              {u.email && <div className="text-meta text-text-3">{u.email}</div>}
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

const SLA_TOTAL_MS = 4 * 60 * 60 * 1000;

function SlaBlock({ lead }: { lead: NonNullable<ReturnType<typeof useLead>["data"]> }) {
  const isActive = lead.status === "NEW" || lead.status === "IN_PROGRESS";
  if (!isActive || lead.firstRespondedAt) return null;

  const dueAt = new Date(lead.firstResponseDueAt).getTime();
  const now = Date.now();
  const overdueMs = now - dueAt;

  if (overdueMs > 0) {
    const hours = Math.floor(overdueMs / 3_600_000);
    const minutes = Math.floor((overdueMs % 3_600_000) / 60_000);
    return (
      <div className="flex items-start gap-2 rounded-md border border-status-overdue/35 bg-status-overdue-tint px-3 py-2.5">
        <Clock className="mt-0.5 size-4 shrink-0 text-status-overdue" />
        <div>
          <p className="text-ui font-medium text-status-overdue">
            Первый ответ просрочен на {hours} ч {minutes} мин
          </p>
          <p className="text-meta text-text-3">SLA 4 ч</p>
        </div>
      </div>
    );
  }

  const remainingMs = dueAt - now;
  const hours = Math.floor(remainingMs / 3_600_000);
  const minutes = Math.floor((remainingMs % 3_600_000) / 60_000);
  const progress = Math.max(0, Math.min(1, 1 - remainingMs / SLA_TOTAL_MS));
  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-mono text-meta font-medium text-status-review">
        осталось {hours} ч {minutes} мин
      </p>
      <div className="h-1 overflow-hidden rounded-full bg-surface-sunk">
        <div className="h-full rounded-full bg-status-review" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}

/** Ответственный — только снимок Bitrix24-пользователя с момента "Передать в CRM"
 * (leadService.convertToCrm), не редактируемое поле: продажники работают в Bitrix,
 * не в HotLine, назначение там же и происходит (см. ConvertToCrmDialog). До
 * конвертации у заявки нет ответственного вовсе. */
function AssigneeCard({
  bitrixAssignee,
  autoAssignReason,
}: {
  bitrixAssignee: { name: string; email: string | null } | null;
  /** Причина алгоритмического выбора (leadAssignmentService.pickAssignee) — null у
   * ручной передачи в CRM (ConvertToCrmDialog), см. grill-me допрос 2026-09-12. */
  autoAssignReason: string | null;
}) {
  if (!bitrixAssignee) return null;
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <p className="font-mono text-label font-medium uppercase tracking-wide text-text-3">Ответственный в Bitrix24</p>
        <p className="text-ui text-text-1">{bitrixAssignee.name}</p>
        {bitrixAssignee.email && <p className="text-meta text-text-3">{bitrixAssignee.email}</p>}
        {autoAssignReason && <p className="text-meta text-text-3">Авто-назначение: {autoAssignReason}</p>}
      </CardContent>
    </Card>
  );
}

export function LeadDetailPage() {
  useLeadsRealtime();
  const isMobile = useIsMobile();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data: lead, isLoading } = useLead(id);
  const stopList = useStopListLead(id);
  const restore = useRestoreLead(id);
  const reply = useReplyToLead(id);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [stopListDialogOpen, setStopListDialogOpen] = useState(false);
  const [replyText, setReplyText] = useState("");

  if (isLoading || !lead) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <div className="size-9 shrink-0 animate-pulse rounded-md bg-surface-sunk" />
          <div className="h-6 w-28 animate-pulse rounded bg-surface-sunk" />
        </div>
        <div className="h-7 w-2/3 animate-pulse rounded bg-surface-sunk" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className="flex min-h-[420px] flex-col gap-3">
            <div className="h-24 w-3/4 animate-pulse rounded-lg bg-surface-sunk" />
            <div className="ml-auto h-16 w-1/2 animate-pulse rounded-lg bg-surface-sunk" />
          </div>
          <div className="flex flex-col gap-3">
            <div className="h-24 animate-pulse rounded-lg bg-surface-sunk" />
            <div className="h-32 animate-pulse rounded-lg bg-surface-sunk" />
          </div>
        </div>
      </div>
    );
  }

  async function handleReply() {
    if (!replyText.trim() || reply.isPending) return;
    await reply.mutateAsync(replyText);
    setReplyText("");
  }

  if (isMobile) {
    return (
      <>
        <MobileLeadDetail
          lead={lead}
          onBack={() => navigate("/leads")}
          onStopList={() => setStopListDialogOpen(true)}
          stopListPending={stopList.isPending}
          onConvertClick={() => setConvertDialogOpen(true)}
          onRestore={() => restore.mutate()}
          restorePending={restore.isPending}
          replyText={replyText}
          onReplyTextChange={setReplyText}
          onSendReply={() => void handleReply()}
          sendReplyPending={reply.isPending}
          getAttachmentQueryKey={(attachmentId) => ["attachment-url", "lead", id, attachmentId]}
          fetchAttachmentUrl={(attachmentId, download) => fetchLeadAttachmentUrl(id, attachmentId, download)}
        />
        <ConvertToCrmDialog leadId={id} open={convertDialogOpen} onClose={() => setConvertDialogOpen(false)} />
        <ReasonDialog
          open={stopListDialogOpen}
          onClose={() => setStopListDialogOpen(false)}
          title="В стоп-лист"
          description="Причина необязательна — спам / нецелевое обращение."
          placeholder="Причина…"
          confirmLabel="В стоп-лист"
          pending={stopList.isPending}
          onConfirm={async (reason) => {
            await stopList.mutateAsync(reason);
            setStopListDialogOpen(false);
          }}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate("/leads")}
              className="flex size-9 shrink-0 items-center justify-center rounded-md border border-rule-strong text-text-2 hover:bg-surface-sunk"
              aria-label="Назад"
            >
              <ArrowLeft className="size-4" />
            </button>
            <span className="font-mono text-[22px] tabular-nums text-text-2">{lead.publicNumber}</span>
          </div>
          <h1 className="mt-1 text-[22px] font-semibold text-text-1">{lead.subject}</h1>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[lead.status]}>{LEAD_STATUS_LABELS[lead.status]}</Badge>
            <span className="font-mono text-meta text-text-3">
              Почта · {lead.fromEmail} · {new Date(lead.createdAt).toLocaleString("ru-RU")}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {(lead.status === "NEW" || lead.status === "IN_PROGRESS") && (
            <>
              <Button variant="outline" disabled={stopList.isPending} onClick={() => setStopListDialogOpen(true)}>
                В стоп-лист
              </Button>
              <Button onClick={() => setConvertDialogOpen(true)}>Передать в CRM</Button>
            </>
          )}
          {lead.status === "STOP_LISTED" && (
            <Button variant="outline" disabled={restore.isPending} onClick={() => restore.mutate()}>
              Вернуть в работу
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex min-h-[420px] flex-col gap-3">
          {lead.messages.map((m) =>
            m.direction === "OUTBOUND" ? (
              <div key={m.id} className="ml-auto flex max-w-[74%] flex-col items-end gap-1">
                <div className="rounded-[12px_12px_4px_12px] bg-action px-3.5 py-2.5 text-body text-action-fg">
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </div>
                <p className="font-mono text-label text-text-3">
                  {m.sentBy?.fullName ?? "Сотрудник"} · {new Date(m.receivedAt).toLocaleString("ru-RU")} · доставлено
                </p>
              </div>
            ) : (
              <div key={m.id} className="flex max-w-[74ch] flex-col gap-1 rounded-lg border border-rule bg-surface p-3.5">
                <div className="flex items-center justify-between text-meta text-text-3">
                  <span>{m.fromEmail}</span>
                  <span>{new Date(m.receivedAt).toLocaleString("ru-RU")}</span>
                </div>
                <p className="whitespace-pre-wrap text-body text-text-1">{m.body}</p>
                {Boolean(m.attachments.length) && (
                  <AttachmentGallery
                    attachments={m.attachments.map((a) => ({
                      id: a.id,
                      mimeType: a.mimeType,
                      fileSize: a.fileSize,
                      label: a.filename,
                    }))}
                    getQueryKey={(attachmentId) => ["attachment-url", "lead", id, attachmentId]}
                    fetchUrl={(attachmentId, download) => fetchLeadAttachmentUrl(id, attachmentId, download)}
                  />
                )}
              </div>
            ),
          )}
          {!lead.messages.length && <p className="text-ui text-text-3">Переписки пока нет.</p>}

          {lead.status !== "STOP_LISTED" && (
            <div className="mt-auto flex flex-col gap-2 border-t border-rule pt-3">
              <p className="text-meta text-text-3">Ответ уйдёт с sales@lemarkllc.ru, тема сохранится · Enter — отправить</p>
              <div className="flex gap-2">
                <Textarea
                  rows={2}
                  className="min-h-16"
                  placeholder="Ответить клиенту…"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleReply();
                    }
                  }}
                />
                <Button disabled={!replyText.trim() || reply.isPending} onClick={handleReply}>
                  Отправить
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <AssigneeCard bitrixAssignee={lead.bitrixAssignee} autoAssignReason={lead.autoAssignReason} />
          <Card>
            <CardContent className="flex flex-col gap-2 p-4 text-ui">
              <p className="font-mono text-label font-medium uppercase tracking-wide text-text-3">Клиент</p>
              <div className="flex justify-between gap-2">
                <span className="text-text-3">Email</span>
                <span className="truncate text-text-1">{lead.fromEmail}</span>
              </div>
              {lead.fromName && (
                <div className="flex justify-between gap-2">
                  <span className="text-text-3">Имя</span>
                  <span className="text-text-1">{lead.fromName}</span>
                </div>
              )}
              {lead.extractedPhone && (
                <div className="flex justify-between gap-2">
                  <span className="text-text-3">Телефон</span>
                  <span className="text-text-1">{lead.extractedPhone}</span>
                </div>
              )}
              {lead.extractedEmail && (
                <div className="flex justify-between gap-2">
                  <span className="text-text-3">Доп. email</span>
                  <span className="truncate text-text-1">{lead.extractedEmail}</span>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-2 p-4 text-ui">
              <p className="font-mono text-label font-medium uppercase tracking-wide text-text-3">Заявка</p>
              {lead.aiIsRelevant !== null && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-text-3">ИИ</span>
                  <Badge variant={lead.aiIsRelevant ? "success" : "warning"}>
                    {lead.aiIsRelevant ? "релевантно" : "нерелевантно"}
                  </Badge>
                </div>
              )}
              {lead.aiReasoning && <p className="text-meta text-text-3">{lead.aiReasoning}</p>}
              {lead.status === "CONVERTED" && lead.bitrixLeadId && (
                <div className="flex justify-between gap-2">
                  <span className="text-text-3">Лид Bitrix24</span>
                  <span className="text-text-1">#{lead.bitrixLeadId}</span>
                </div>
              )}
              {lead.status === "STOP_LISTED" && lead.stopListReason && (
                <div className="flex justify-between gap-2">
                  <span className="text-text-3">Причина</span>
                  <span className="text-text-1">{lead.stopListReason}</span>
                </div>
              )}
              <SlaBlock lead={lead} />
            </CardContent>
          </Card>
        </div>
      </div>

      <ConvertToCrmDialog leadId={id} open={convertDialogOpen} onClose={() => setConvertDialogOpen(false)} />
      <ReasonDialog
        open={stopListDialogOpen}
        onClose={() => setStopListDialogOpen(false)}
        title="В стоп-лист"
        description="Причина необязательна — спам / нецелевое обращение."
        placeholder="Причина…"
        confirmLabel="В стоп-лист"
        pending={stopList.isPending}
        onConfirm={async (reason) => {
          await stopList.mutateAsync(reason);
          setStopListDialogOpen(false);
        }}
      />
    </div>
  );
}
