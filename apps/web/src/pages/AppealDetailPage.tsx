import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, EyeOff, MessageSquare, ShieldAlert } from "lucide-react";
import {
  APPEAL_STATUS_LABELS,
  APPEAL_STATUS_TRANSITIONS,
  RESIGNATION_OUTCOME_LABELS,
  type AppealStatus,
  type ResignationOutcome,
} from "@hotline/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModeBadge, StatusBadge, TypeLabel } from "@/components/appeals/badges";
import { MentionTextarea } from "@/components/appeals/MentionTextarea";
import { AttachmentGallery } from "@/components/attachments/AttachmentGallery";
import { AppealDetailMobile } from "@/components/mobile/AppealDetailMobile";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  useAddComment,
  useAppeal,
  useAssignAppeal,
  useAttachmentUrl,
  useAuditLog,
  useChangeStatus,
  useEpics,
  useMentionableUsers,
  useRevealAuthor,
  useSetEpic,
  useSetWorkingEdit,
  useAssignableUsers,
} from "@/hooks/api";
import { useAuthStore } from "@/lib/authStore";
import { cn } from "@/lib/utils";

const FINAL_ANSWER_MAX = 4000;

type ThreadEntry =
  | { kind: "message"; id: string; createdAt: string; fromHrd: boolean; fromFullName: string | null; text: string }
  | { kind: "internal"; id: string; createdAt: string; authorFullName: string; text: string }
  | { kind: "status"; id: string; createdAt: string; fromStatus: string | null; toStatus: string };

type ThreadFilter = "all" | "author" | "internal" | "events";

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "СЕГОДНЯ";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" }).toUpperCase();
}

export function AppealDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: appeal, isLoading } = useAppeal(id);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const activeChannel = useAuthStore((s) => s.activeChannel);

  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [finalAnswer, setFinalAnswer] = useState("");
  const [resignationOutcome, setResignationOutcome] = useState<ResignationOutcome | "">("");
  const [requestRating, setRequestRating] = useState(true);
  const [workingEdit, setWorkingEdit] = useState("");
  const [composerMode, setComposerMode] = useState<"author" | "internal">("author");
  const [composerText, setComposerText] = useState("");
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [threadFilter, setThreadFilter] = useState<ThreadFilter>("all");
  const [activeTab, setActiveTab] = useState("thread");
  const [revealDialogOpen, setRevealDialogOpen] = useState(false);
  const [revealPassword, setRevealPassword] = useState("");
  const [revealError, setRevealError] = useState("");
  const [revealedAuthor, setRevealedAuthor] = useState<{ id: string; fullName: string } | null>(null);
  const revealAuthor = useRevealAuthor(id);

  // Точка на вкладке "Тред" — снимок с ПЕРВОЙ успешной загрузки карточки, не с каждого
  // 5-секундного поллинга (useAppeal), иначе точка гаснет сама через один тик вместо
  // того, чтобы ждать, пока пользователь реально откроет вкладку.
  const [unreadTabs, setUnreadTabs] = useState({ messages: false, internal: false });
  const unreadTabsInitialized = useRef(false);
  useEffect(() => {
    if (appeal && !unreadTabsInitialized.current) {
      unreadTabsInitialized.current = true;
      setUnreadTabs(appeal.unreadTabs);
    }
  }, [appeal]);

  const canReadAuthor = hasPermission("appeal.read_author", appeal?.channel);
  const canClassify = hasPermission("appeal.read_all", appeal?.channel);
  const canAssign = hasPermission("appeal.assign", appeal?.channel);
  const canClose = hasPermission("appeal.close", appeal?.channel);
  const canReadAudit = hasPermission("audit.read", appeal?.channel);

  const changeStatus = useChangeStatus(id);
  const setWorkingEditMutation = useSetWorkingEdit(id);
  const setEpicMutation = useSetEpic(id);
  const assignMutation = useAssignAppeal(id);
  const addComment = useAddComment(id);
  const { data: epics } = useEpics(appeal?.channel ?? activeChannel);
  const { data: managers } = useAssignableUsers(appeal?.channel ?? activeChannel, canAssign);
  const { data: auditEntries } = useAuditLog({ appealId: id }, canReadAudit);
  const { data: mentionableUsers } = useMentionableUsers(id, composerMode === "internal");
  const getAttachmentUrl = useAttachmentUrl();

  const thread = useMemo<ThreadEntry[]>(() => {
    if (!appeal) return [];
    const entries: ThreadEntry[] = [
      ...appeal.messages.map((m) => ({ kind: "message" as const, ...m })),
      ...appeal.comments
        .filter((c) => c.visibility === "INTERNAL")
        .map((c) => ({ kind: "internal" as const, id: c.id, createdAt: c.createdAt, authorFullName: c.authorFullName, text: c.text })),
      ...appeal.statusHistory.map((h, i) => ({ kind: "status" as const, id: `status-${i}`, ...h })),
    ];
    return entries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [appeal]);

  const filteredThread = thread.filter((e) => {
    if (threadFilter === "all") return true;
    if (threadFilter === "author") return e.kind === "message";
    if (threadFilter === "internal") return e.kind === "internal";
    return e.kind === "status";
  });

  if (isLoading || !appeal) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-4 w-24 animate-pulse rounded bg-surface-sunk" />
        <div className="h-24 w-full animate-pulse rounded-lg bg-surface-sunk" />
      </div>
    );
  }

  const availableTransitions = APPEAL_STATUS_TRANSITIONS[appeal.status];

  async function handleTransition(toStatus: AppealStatus) {
    if (toStatus === "CLOSED") {
      setCloseDialogOpen(true);
      return;
    }
    const reason =
      appeal!.status === "CLOSED" ? window.prompt("Причина повторного открытия (обязательно):") ?? "" : undefined;
    if (appeal!.status === "CLOSED" && !reason?.trim()) return;
    await changeStatus.mutateAsync({ toStatus, reason });
  }

  function openComposer(mode: "author" | "internal") {
    setComposerMode(mode);
    setActiveTab("thread");
    requestAnimationFrame(() => document.getElementById("thread-composer")?.focus());
  }

  async function handleSend() {
    if (!composerText.trim() || addComment.isPending) return;
    if (composerMode === "author") {
      await addComment.mutateAsync({ text: composerText, visibility: "PUBLIC" });
    } else {
      await addComment.mutateAsync({ text: composerText, visibility: "INTERNAL", mentionedUserIds });
      setMentionedUserIds([]);
    }
    setComposerText("");
  }

  async function handleRevealAuthor() {
    setRevealError("");
    try {
      const author = await revealAuthor.mutateAsync(revealPassword);
      setRevealedAuthor(author);
      setRevealDialogOpen(false);
      setRevealPassword("");
    } catch {
      setRevealError("Неверный пароль или недостаточно прав.");
    }
  }

  // Диалоги пароля-подтверждения раскрытия автора и закрытия обращения — общие для
  // десктопа и мобильного экрана (Radix Dialog порталит контент поверх всего вне
  // зависимости от того, где в дереве он смонтирован), поэтому логика/state одни и
  // те же (revealAuthor/changeStatus mutation), не дублируются между ветками.
  const revealDialogEl = (
    <Dialog
      open={revealDialogOpen}
      onOpenChange={(open) => {
        setRevealDialogOpen(open);
        if (!open) {
          setRevealPassword("");
          setRevealError("");
        }
      }}
    >
      <DialogContent>
        <DialogTitle>Раскрыть автора конфиденциального обращения</DialogTitle>
        <DialogDescription>Единственная необратимая кнопка в системе — прочитайте до конца.</DialogDescription>
        <ul className="mt-3 flex flex-col gap-1.5 rounded-md bg-surface-sunk p-3 text-ui text-text-2">
          <li>• Автор получит уведомление о раскрытии</li>
          <li>• Запись попадёт в журнал аудита с вашим именем и временем</li>
          <li>• Вернуть конфиденциальность обратно нельзя</li>
        </ul>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void handleRevealAuthor();
          }}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor="revealPassword">Пароль (код 2FA повторно не запрашивается)</Label>
            <Input
              id="revealPassword"
              type="password"
              autoFocus
              value={revealPassword}
              onChange={(e) => setRevealPassword(e.target.value)}
              required
              aria-invalid={Boolean(revealError)}
            />
          </div>
          {revealError && <p className="text-meta text-status-overdue">{revealError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRevealDialogOpen(false)}>
              Отменить
            </Button>
            <Button type="submit" variant="destructive" disabled={!revealPassword || revealAuthor.isPending}>
              Раскрыть автора — необратимо
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  const closeDialogEl = (
    <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
      <DialogContent>
        <DialogTitle>Закрытие обращения</DialogTitle>
        <DialogDescription>Закрытие требует итогового ответа автору (FR-WF-005).</DialogDescription>
        <div className="mt-4 flex flex-col gap-1">
          <Textarea
            rows={4}
            autoFocus
            className="min-h-[104px]"
            maxLength={FINAL_ANSWER_MAX}
            value={finalAnswer}
            onChange={(e) => setFinalAnswer(e.target.value)}
          />
          <p className="self-end font-mono text-label tabular-nums text-text-3">
            {finalAnswer.length} / {FINAL_ANSWER_MAX}
          </p>
        </div>
        {appeal.type === "RESIGNATION" && (
          <div className="flex flex-col gap-1">
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
        <label className="mt-1 flex items-center gap-2 text-ui text-text-1">
          <input type="checkbox" checked={requestRating} onChange={(e) => setRequestRating(e.target.checked)} />
          Запросить у автора оценку решения
        </label>
        <div className="rounded-md border border-status-review/35 bg-status-review-tint px-3 py-2.5 text-meta text-text-2">
          Переоткрыть можно в течение 14 дней — потребуется причина, она попадёт в тред отдельным событием.
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>
            Отменить
          </Button>
          <Button
            disabled={
              !finalAnswer.trim() ||
              changeStatus.isPending ||
              (appeal.type === "RESIGNATION" && !resignationOutcome)
            }
            onClick={async () => {
              await changeStatus.mutateAsync({
                toStatus: "CLOSED",
                finalAnswer,
                resignationOutcome: resignationOutcome || undefined,
              });
              setCloseDialogOpen(false);
              setFinalAnswer("");
              setResignationOutcome("");
            }}
          >
            Закрыть обращение
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (isMobile) {
    return (
      <>
        <AppealDetailMobile
          appeal={appeal}
          onBack={() => navigate("/appeals")}
          activeTab={activeTab as "appeal" | "messages" | "internal" | "attachments"}
          onTabChange={(tab) => {
            setActiveTab(tab);
            if (tab === "messages" || tab === "internal") {
              setUnreadTabs((t) => ({ ...t, [tab]: false }));
            }
          }}
          unreadTabs={unreadTabs}
          availableTransitions={availableTransitions}
          canClose={canClose}
          canClassify={canClassify}
          canAssign={canAssign}
          canReadAuthor={canReadAuthor}
          revealedAuthor={revealedAuthor}
          onRevealClick={() => setRevealDialogOpen(true)}
          onTransitionClick={handleTransition}
          transitionPending={changeStatus.isPending}
          managers={managers}
          onAssign={(userId) => assignMutation.mutate(userId)}
          workingEdit={workingEdit}
          onWorkingEditChange={setWorkingEdit}
          onSaveWorkingEdit={() => setWorkingEditMutation.mutate(workingEdit)}
          saveWorkingEditPending={setWorkingEditMutation.isPending}
          newMessage={composerMode === "author" ? composerText : ""}
          onNewMessageChange={setComposerText}
          onSendMessage={handleSend}
          sendPending={addComment.isPending}
          newInternalNote={composerMode === "internal" ? composerText : ""}
          onNewInternalNoteChange={setComposerText}
          mentionableUsers={mentionableUsers}
          mentionedUserIds={mentionedUserIds}
          onMentionedUserIdsChange={setMentionedUserIds}
          onAddInternalNote={handleSend}
          addNotePending={addComment.isPending}
          getAttachmentQueryKey={(attachmentId) => ["attachment-url", "appeal", id, attachmentId]}
          fetchAttachmentUrl={(attachmentId, download) =>
            getAttachmentUrl.mutateAsync({ appealId: id, attachmentId, download }).then((r) => r.url)
          }
        />
        {revealDialogEl}
        {closeDialogEl}
      </>
    );
  }

  const hasUnread = unreadTabs.messages || unreadTabs.internal;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-[22px] tabular-nums text-text-2">{appeal.publicNumber}</h1>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={appeal.status} />
            <ModeBadge mode={appeal.mode} />
            <TypeLabel type={appeal.type} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableTransitions.map((s) => (
            <Button
              key={s}
              variant="outline"
              size="sm"
              disabled={(s === "CLOSED" && !canClose) || changeStatus.isPending}
              onClick={() => handleTransition(s)}
            >
              {s === "IN_PROGRESS" ? "Взять в работу" : `→ ${APPEAL_STATUS_LABELS[s]}`}
            </Button>
          ))}
        </div>
      </div>

      {/* "Автор скрыт" — содержимое, не иконка в углу (design_handoff_lemark_one/README.md). */}
      <Card className={appeal.mode === "CONFIDENTIAL" ? "border-confidential/40" : undefined}>
        <CardContent className="flex items-center gap-3 p-4">
          {appeal.isAuthorHidden ? (
            revealedAuthor ? (
              <>
                <ShieldAlert className="size-5 text-confidential" />
                <div>
                  <p className="text-ui font-medium text-confidential">{revealedAuthor.fullName}</p>
                  <p className="text-meta text-text-3">Автор раскрыт для этого просмотра — действие зафиксировано в аудите.</p>
                </div>
              </>
            ) : appeal.canRevealAuthor ? (
              <button type="button" onClick={() => setRevealDialogOpen(true)} className="flex w-full items-center gap-3 text-left">
                <div className="flex size-9 items-center justify-center rounded-full bg-confidential-tint">
                  <EyeOff className="size-4 text-confidential" />
                </div>
                <div>
                  <p className="text-ui font-medium text-confidential underline decoration-dotted">
                    Автор скрыт (конфиденциальный режим) — нажмите, чтобы раскрыть
                  </p>
                  <p className="text-meta text-text-3">Потребуется повторный ввод пароля; каждый просмотр журналируется.</p>
                </div>
              </button>
            ) : (
              <>
                <div className="flex size-9 items-center justify-center rounded-full bg-confidential-tint">
                  <EyeOff className="size-4 text-confidential" />
                </div>
                <div>
                  <p className="text-ui font-medium text-confidential">Автор скрыт (конфиденциальный режим)</p>
                  <p className="text-meta text-text-3">Данные автора доступны только HRD и Администратору.</p>
                </div>
              </>
            )
          ) : (
            <>
              <ShieldAlert className="size-5 text-text-3" />
              <div>
                <p className="text-ui font-medium text-text-1">{appeal.author?.fullName ?? "Автор не указан"}</p>
                <p className="text-meta text-text-3">Автор обращения</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        {canClassify && (
          <Select value={appeal.epic?.id ?? "none"} onValueChange={(v) => setEpicMutation.mutate(v === "none" ? null : v)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Эпик" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Без эпика</SelectItem>
              {epics?.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {canAssign && (
          <Select onValueChange={(v) => assignMutation.mutate(v)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder={appeal.assignees[0]?.fullName ?? "Назначить менеджера"} />
            </SelectTrigger>
            <SelectContent>
              {managers?.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value);
          if (value === "thread") setUnreadTabs({ messages: false, internal: false });
        }}
      >
        <TabsList>
          <TabsTrigger value="thread" className="relative">
            Тред
            {hasUnread && <span className="absolute -right-2 top-0 size-1.5 rounded-full bg-status-overdue" />}
          </TabsTrigger>
          <TabsTrigger value="appeal">Обращение</TabsTrigger>
          <TabsTrigger value="attachments">Вложения</TabsTrigger>
          <TabsTrigger value="audit">Аудит</TabsTrigger>
        </TabsList>

        <TabsContent value="thread" className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "Всё", "bg-text-3"],
                ["author", "С автором", "bg-status-open"],
                ["internal", "Внутренние", "bg-status-review"],
                ["events", "События", "bg-text-3"],
              ] as [ThreadFilter, string, string][]
            ).map(([value, label, dot]) => (
              <button
                key={value}
                type="button"
                onClick={() => setThreadFilter(value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-meta font-medium transition-colors duration-1",
                  threadFilter === value ? "bg-action text-action-fg" : "bg-surface-sunk text-text-2 hover:text-text-1",
                )}
              >
                <span className={cn("size-1.5 rounded-full", threadFilter === value ? "bg-action-fg" : dot)} />
                {label}
              </button>
            ))}
          </div>

          <div className="flex min-h-[280px] flex-col gap-3 rounded-lg border border-rule bg-surface p-4">
            {!filteredThread.length && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
                <MessageSquare className="size-8 text-text-3" />
                <p className="text-ui text-text-2">Переписки пока нет</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => openComposer("author")}>
                    Запросить уточнение
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openComposer("internal")}>
                    Заметка для коллег
                  </Button>
                </div>
              </div>
            )}
            {filteredThread.map((entry, i) => {
              const prev = filteredThread[i - 1];
              const showSeparator = !prev || new Date(prev.createdAt).toDateString() !== new Date(entry.createdAt).toDateString();
              const time = new Date(entry.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
              return (
                <div key={`${entry.kind}-${entry.id}`} className="flex flex-col gap-3">
                  {showSeparator && (
                    <div className="flex items-center gap-3 py-1">
                      <span className="h-px flex-1 bg-rule" />
                      <span className="font-mono text-label text-text-3">{dayLabel(entry.createdAt)}</span>
                      <span className="h-px flex-1 bg-rule" />
                    </div>
                  )}
                  {entry.kind === "status" && (
                    <div className="flex items-center gap-2 py-1 text-meta text-text-3">
                      <span className="size-1.5 rounded-full border border-text-3" />
                      {entry.fromStatus ? `${APPEAL_STATUS_LABELS[entry.fromStatus as AppealStatus]} → ` : ""}
                      {APPEAL_STATUS_LABELS[entry.toStatus as AppealStatus]}
                      <span className="ml-auto font-mono">{time}</span>
                    </div>
                  )}
                  {entry.kind === "internal" && (
                    <div className="flex flex-col gap-1 border-l-2 border-status-review pl-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-status-review-tint px-2 py-0.5 text-label font-medium uppercase tracking-wide text-status-review">
                          Внутренняя заметка
                        </span>
                        <span className="text-meta text-text-3">
                          {entry.authorFullName} · {time}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-body text-text-1">{entry.text}</p>
                    </div>
                  )}
                  {entry.kind === "message" && !entry.fromHrd && (
                    <div className="flex max-w-[74%] items-start gap-2.5">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-sunk text-meta font-medium text-text-2">
                        {(appeal.author?.fullName ?? "А")[0]}
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="rounded-[12px_12px_12px_4px] border border-rule bg-surface px-3.5 py-2.5">
                          <p className="whitespace-pre-wrap text-body text-text-1">{entry.text}</p>
                        </div>
                        <p className="font-mono text-label text-text-3">
                          {appeal.isAuthorHidden ? "Автор" : appeal.author?.fullName ?? "Автор"} · {time}
                        </p>
                      </div>
                    </div>
                  )}
                  {entry.kind === "message" && entry.fromHrd && (
                    <div className="ml-auto flex max-w-[74%] flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full bg-status-open-tint px-2 py-0.5 text-label font-medium uppercase tracking-wide text-status-open">
                          Автору в бот
                        </span>
                      </div>
                      <div className="rounded-[12px_12px_4px_12px] bg-action px-3.5 py-2.5">
                        <p className="whitespace-pre-wrap text-body text-action-fg">{entry.text}</p>
                      </div>
                      <p className="font-mono text-label text-text-3">
                        {entry.fromFullName ?? "Сотрудник"} · {time}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Один композер с переключателем режима вместо двух полей на разных вкладках
           * (design_handoff_lemark_one/README.md) — режим меняет рамку, подпись и текст кнопки. */}
          <div
            className={cn(
              "flex flex-col gap-2 rounded-lg border-2 p-3 transition-colors duration-1",
              composerMode === "author" ? "border-rule-strong" : "border-status-review",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex gap-1 rounded-full bg-surface-sunk p-0.5">
                <button
                  type="button"
                  onClick={() => setComposerMode("author")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-meta font-medium transition-colors duration-1",
                    composerMode === "author" ? "bg-surface text-text-1 shadow-1" : "text-text-3",
                  )}
                >
                  <span className="size-1.5 rounded-full bg-status-open" /> Ответ автору
                </button>
                <button
                  type="button"
                  onClick={() => setComposerMode("internal")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-meta font-medium transition-colors duration-1",
                    composerMode === "internal" ? "bg-surface text-text-1 shadow-1" : "text-text-3",
                  )}
                >
                  <span className="size-1.5 rounded-full bg-status-review" /> Внутренняя заметка
                </button>
              </div>
              <span className="text-meta text-text-3">
                {composerMode === "author" ? "Уйдёт в Telegram-бот автору" : "Автор этого не увидит"}
              </span>
            </div>
            <div className="flex gap-2">
              {composerMode === "internal" ? (
                <MentionTextarea
                  value={composerText}
                  onChange={setComposerText}
                  users={mentionableUsers ?? []}
                  mentionedUserIds={mentionedUserIds}
                  onMentionedUserIdsChange={setMentionedUserIds}
                  onSubmit={() => void handleSend()}
                  rows={2}
                  placeholder="Внутренняя заметка (не видна автору)... @ФИО — тегнуть коллегу"
                  className="border-none bg-transparent px-0 focus-visible:outline-none"
                />
              ) : (
                <Textarea
                  id="thread-composer"
                  rows={2}
                  placeholder="Написать автору (например, запросить уточнение)…"
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  className="border-none bg-transparent px-0 focus-visible:outline-none"
                />
              )}
              <Button disabled={!composerText.trim() || addComment.isPending} onClick={handleSend} className="self-end">
                {composerMode === "author" ? "Отправить" : "Добавить заметку"}
              </Button>
            </div>
            <p className="text-label text-text-3">Enter — отправить · Shift+Enter — перенос</p>
          </div>
        </TabsContent>

        <TabsContent value="appeal" className="flex flex-col gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="mb-1 font-mono text-label font-medium uppercase tracking-wide text-text-3">Оригинальный текст</p>
              <p className="whitespace-pre-wrap text-ui text-text-1">{appeal.originalText}</p>
            </CardContent>
          </Card>
          {canReadAuthor && (
            <Card>
              <CardContent className="flex flex-col gap-2 p-4">
                <p className="font-mono text-label font-medium uppercase tracking-wide text-text-3">
                  Рабочая редакция (нейтральная формулировка для менеджера, SRS §7.3)
                </p>
                <Textarea
                  rows={3}
                  defaultValue={appeal.workingEdit ?? ""}
                  onChange={(e) => setWorkingEdit(e.target.value)}
                  placeholder="Необязательно — обезличенная формулировка без деталей, раскрывающих автора"
                />
                <Button
                  size="sm"
                  className="self-start"
                  disabled={!workingEdit.trim() || setWorkingEditMutation.isPending}
                  onClick={() => setWorkingEditMutation.mutate(workingEdit)}
                >
                  Сохранить рабочую редакцию
                </Button>
              </CardContent>
            </Card>
          )}
          {appeal.rating && (
            <Card>
              <CardContent className="p-4 text-ui">
                {appeal.rating.score !== null ? (
                  <>
                    Оценка автора: <span className="font-semibold tabular-nums">{appeal.rating.score}/5</span>
                    {appeal.rating.comment && <p className="mt-1 text-text-3">{appeal.rating.comment}</p>}
                  </>
                ) : (
                  <div className="flex flex-col gap-1">
                    <span>
                      Порекомендовал(а) бы нас: <span className="font-semibold tabular-nums">{appeal.rating.wouldRecommendScore}/5</span>
                    </span>
                    <span>
                      Обратится ли снова: <span className="font-semibold tabular-nums">{appeal.rating.wouldReturnScore}/5</span>
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="attachments" className="flex flex-col gap-2">
          <AttachmentGallery
            attachments={appeal.attachments.map((a) => ({
              id: a.id,
              mimeType: a.mimeType,
              fileSize: a.fileSize,
              label: a.kind === "PHOTO" ? "Фото" : "Видео",
            }))}
            getQueryKey={(attachmentId) => ["attachment-url", "appeal", id, attachmentId]}
            fetchUrl={(attachmentId, download) => getAttachmentUrl.mutateAsync({ appealId: id, attachmentId, download }).then((r) => r.url)}
          />
        </TabsContent>

        <TabsContent value="audit" className="flex flex-col gap-2">
          {!auditEntries?.length && (
            <p className="flex items-center gap-2 text-ui text-text-3">
              <AlertCircle className="size-4" /> Записей аудита нет.
            </p>
          )}
          {auditEntries?.map((entry) => (
            <div key={entry.id} className="flex items-center gap-2 text-ui">
              <span className="font-mono text-meta text-text-3">{new Date(entry.createdAt).toLocaleString("ru-RU")}</span>
              <span className="text-text-1">{entry.action}</span>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      {revealDialogEl}
      {closeDialogEl}
    </div>
  );
}
