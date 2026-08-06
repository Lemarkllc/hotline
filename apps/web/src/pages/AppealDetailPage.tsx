import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { EyeOff, ShieldAlert } from "lucide-react";
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
  const [workingEdit, setWorkingEdit] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newInternalNote, setNewInternalNote] = useState("");
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("appeal");
  const [revealDialogOpen, setRevealDialogOpen] = useState(false);
  const [revealPassword, setRevealPassword] = useState("");
  const [revealError, setRevealError] = useState("");
  const [revealedAuthor, setRevealedAuthor] = useState<{ id: string; fullName: string } | null>(null);
  const revealAuthor = useRevealAuthor(id);

  // Точки на вкладках "Переписка"/"Внутренняя работа" — снимок с ПЕРВОЙ успешной
  // загрузки карточки, не с каждого 5-секундного поллинга (useAppeal), иначе точка
  // гаснет сама через один тик вместо того, чтобы ждать, пока пользователь реально
  // откроет вкладку.
  const [unreadTabs, setUnreadTabs] = useState({ messages: false, internal: false });
  const unreadTabsInitialized = useRef(false);
  useEffect(() => {
    if (appeal && !unreadTabsInitialized.current) {
      unreadTabsInitialized.current = true;
      setUnreadTabs(appeal.unreadTabs);
    }
  }, [appeal]);

  // Явный channel = appeal.channel, не глобальный activeChannel переключателя —
  // у конкретно этой карточки канал фиксирован независимо от того, что сейчас
  // выбрано в Sidebar (Фаза 7, PLAN.md §6).
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
  // enabled: без permission эти запросы гарантированно вернут 403 — не дёргаем их зря.
  const { data: managers } = useAssignableUsers(appeal?.channel ?? activeChannel, canAssign);
  const { data: auditEntries } = useAuditLog({ appealId: id }, canReadAudit);
  const { data: mentionableUsers } = useMentionableUsers(id, activeTab === "internal");
  const getAttachmentUrl = useAttachmentUrl();

  if (isLoading || !appeal) {
    return <p className="text-muted-foreground">Загрузка...</p>;
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

  async function handleDownload(attachmentId: string) {
    const result = await getAttachmentUrl.mutateAsync({ appealId: id, attachmentId });
    window.open(result.url, "_blank");
  }

  async function handleSendMessage() {
    if (!newMessage.trim() || addComment.isPending) return;
    await addComment.mutateAsync({ text: newMessage, visibility: "PUBLIC" });
    setNewMessage("");
  }

  async function handleAddInternalNote() {
    if (!newInternalNote.trim() || addComment.isPending) return;
    await addComment.mutateAsync({ text: newInternalNote, visibility: "INTERNAL", mentionedUserIds });
    setNewInternalNote("");
    setMentionedUserIds([]);
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
        <DialogDescription>
          Вы открываете конфиденциальную информацию — личность автора. Это действие будет зафиксировано в
          журнале аудита с вашим именем и временем просмотра. Подтвердите паролем от своей учётной записи.
        </DialogDescription>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void handleRevealAuthor();
          }}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor="revealPassword">Пароль</Label>
            <Input
              id="revealPassword"
              type="password"
              autoFocus
              value={revealPassword}
              onChange={(e) => setRevealPassword(e.target.value)}
              required
            />
          </div>
          {revealError && <p className="text-sm text-destructive">{revealError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRevealDialogOpen(false)}>
              Отменить
            </Button>
            <Button type="submit" disabled={!revealPassword || revealAuthor.isPending}>
              Раскрыть автора
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
        <Textarea rows={4} value={finalAnswer} onChange={(e) => setFinalAnswer(e.target.value)} className="mt-4" />
        {appeal.type === "RESIGNATION" && (
          <div className="mt-4 flex flex-col gap-1">
            <Label>Исход</Label>
            <Select
              value={resignationOutcome}
              onValueChange={(v) => setResignationOutcome(v as ResignationOutcome)}
            >
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
          // Не navigate(-1) — history может быть пустой (открытие по deep link из
          // push-уведомления, новая вкладка, свежий запуск PWA), тогда "назад" молча
          // ничего не делал бы. "/appeals" — всегда валидный, предсказуемый пункт
          // назначения независимо от того, откуда реально попали на карточку.
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
          newMessage={newMessage}
          onNewMessageChange={setNewMessage}
          onSendMessage={handleSendMessage}
          sendPending={addComment.isPending}
          newInternalNote={newInternalNote}
          onNewInternalNoteChange={setNewInternalNote}
          mentionableUsers={mentionableUsers}
          mentionedUserIds={mentionedUserIds}
          onMentionedUserIdsChange={setMentionedUserIds}
          onAddInternalNote={handleAddInternalNote}
          addNotePending={addComment.isPending}
          onDownloadAttachment={handleDownload}
        />
        {revealDialogEl}
        {closeDialogEl}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{appeal.publicNumber}</h1>
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
              → {APPEAL_STATUS_LABELS[s]}
            </Button>
          ))}
        </div>
      </div>

      {/* Блок автора — визуально отделён (SRS §34.5) */}
      <Card className={appeal.mode === "CONFIDENTIAL" ? "border-confidential" : undefined}>
        <CardContent className="flex items-center gap-3 p-4">
          {appeal.isAuthorHidden ? (
            revealedAuthor ? (
              <>
                <ShieldAlert className="size-5 text-confidential" />
                <div>
                  <p className="text-sm font-medium text-confidential">{revealedAuthor.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    Автор раскрыт для этого просмотра — действие зафиксировано в аудите.
                  </p>
                </div>
              </>
            ) : appeal.canRevealAuthor ? (
              <button
                type="button"
                onClick={() => setRevealDialogOpen(true)}
                className="flex w-full items-center gap-3 text-left"
              >
                <EyeOff className="size-5 text-confidential" />
                <div>
                  <p className="text-sm font-medium text-confidential underline decoration-dotted">
                    Автор скрыт (конфиденциальный режим) — нажмите, чтобы раскрыть
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Потребуется повторный ввод пароля; каждый просмотр журналируется.
                  </p>
                </div>
              </button>
            ) : (
              <>
                <EyeOff className="size-5 text-confidential" />
                <div>
                  <p className="text-sm font-medium text-confidential">Автор скрыт (конфиденциальный режим)</p>
                  <p className="text-xs text-muted-foreground">
                    Данные автора доступны только HRD и Администратору; каждый просмотр журналируется.
                  </p>
                </div>
              </>
            )
          ) : (
            <>
              <ShieldAlert className="size-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{appeal.author?.fullName ?? "Автор не указан"}</p>
                <p className="text-xs text-muted-foreground">Автор обращения</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

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
          <DialogDescription>
            Вы открываете конфиденциальную информацию — личность автора. Это действие будет зафиксировано в
            журнале аудита с вашим именем и временем просмотра. Подтвердите паролем от своей учётной записи.
          </DialogDescription>
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void handleRevealAuthor();
            }}
          >
            <div className="flex flex-col gap-1">
              <Label htmlFor="revealPassword">Пароль</Label>
              <Input
                id="revealPassword"
                type="password"
                autoFocus
                value={revealPassword}
                onChange={(e) => setRevealPassword(e.target.value)}
                required
              />
            </div>
            {revealError && <p className="text-sm text-destructive">{revealError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRevealDialogOpen(false)}>
                Отменить
              </Button>
              <Button type="submit" disabled={!revealPassword || revealAuthor.isPending}>
                Раскрыть автора
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
        defaultValue="appeal"
        onValueChange={(value) => {
          setActiveTab(value);
          if (value === "messages" || value === "internal") {
            setUnreadTabs((t) => ({ ...t, [value]: false }));
          }
        }}
      >
        <TabsList>
          <TabsTrigger value="appeal">Обращение</TabsTrigger>
          <TabsTrigger value="messages" className="relative">
            Переписка
            {unreadTabs.messages && (
              <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-destructive" />
            )}
          </TabsTrigger>
          <TabsTrigger value="internal" className="relative">
            Внутренняя работа
            {unreadTabs.internal && (
              <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-destructive" />
            )}
          </TabsTrigger>
          <TabsTrigger value="attachments">Вложения</TabsTrigger>
          <TabsTrigger value="history">История</TabsTrigger>
          <TabsTrigger value="audit">Аудит</TabsTrigger>
        </TabsList>

        <TabsContent value="appeal" className="flex flex-col gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Оригинальный текст</p>
              <p className="whitespace-pre-wrap text-sm">{appeal.originalText}</p>
            </CardContent>
          </Card>
          {canReadAuthor && (
            <Card>
              <CardContent className="flex flex-col gap-2 p-4">
                <p className="text-xs font-medium text-muted-foreground">
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
              <CardContent className="p-4 text-sm">
                {appeal.rating.score !== null ? (
                  <>
                    Оценка автора: <span className="font-semibold tabular-nums">{appeal.rating.score}/5</span>
                    {appeal.rating.comment && <p className="mt-1 text-muted-foreground">{appeal.rating.comment}</p>}
                  </>
                ) : (
                  // CUSTOMER — NPS-style, два отдельных числа вместо score (Фаза 7, PLAN.md §6).
                  <div className="flex flex-col gap-1">
                    <span>
                      Порекомендовал(а) бы нас:{" "}
                      <span className="font-semibold tabular-nums">{appeal.rating.wouldRecommendScore}/5</span>
                    </span>
                    <span>
                      Обратится ли снова:{" "}
                      <span className="font-semibold tabular-nums">{appeal.rating.wouldReturnScore}/5</span>
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="messages" className="flex flex-col gap-3">
          {appeal.messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-lg rounded-lg p-3 text-sm ${m.fromHrd ? "self-start bg-background" : "self-end bg-primary/10"}`}
            >
              <p>{m.text}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {m.fromHrd ? (m.fromFullName ?? "Сотрудник") : (appeal.author?.fullName ?? "Автор")} ·{" "}
                {new Date(m.createdAt).toLocaleString("ru-RU")}
              </p>
            </div>
          ))}
          {!appeal.messages.length && <p className="text-sm text-muted-foreground">Переписки пока нет.</p>}
          <div className="mt-2 flex gap-2">
            <Textarea
              rows={2}
              placeholder="Написать автору (например, запросить уточнение)... Enter — отправить, Shift+Enter — новая строка"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSendMessage();
                }
              }}
            />
            <Button disabled={!newMessage.trim() || addComment.isPending} onClick={handleSendMessage}>
              Отправить
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="internal" className="flex flex-col gap-3">
          {appeal.comments
            .filter((c) => c.visibility === "INTERNAL")
            .map((c) => (
              <div key={c.id} className="rounded-lg bg-background p-3 text-sm">
                <p>{c.text}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.authorFullName} · {new Date(c.createdAt).toLocaleString("ru-RU")}
                </p>
              </div>
            ))}
          <div className="mt-2 flex gap-2">
            <MentionTextarea
              rows={2}
              placeholder="Внутренняя заметка (не видна автору)... @ФИО — тегнуть коллегу. Enter — добавить, Shift+Enter — новая строка"
              value={newInternalNote}
              onChange={setNewInternalNote}
              users={mentionableUsers ?? []}
              mentionedUserIds={mentionedUserIds}
              onMentionedUserIdsChange={setMentionedUserIds}
              onSubmit={() => void handleAddInternalNote()}
            />
            <Button disabled={!newInternalNote.trim() || addComment.isPending} onClick={handleAddInternalNote}>
              Добавить
            </Button>
          </div>
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
            fetchUrl={(attachmentId) => getAttachmentUrl.mutateAsync({ appealId: id, attachmentId }).then((r) => r.url)}
          />
        </TabsContent>

        <TabsContent value="history" className="flex flex-col gap-2">
          {appeal.statusHistory.map((h, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{new Date(h.createdAt).toLocaleString("ru-RU")}</span>
              <span>
                {h.fromStatus ? `${APPEAL_STATUS_LABELS[h.fromStatus as AppealStatus]} → ` : ""}
                {APPEAL_STATUS_LABELS[h.toStatus as AppealStatus]}
              </span>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="audit" className="flex flex-col gap-2">
          {!auditEntries?.length && <p className="text-sm text-muted-foreground">Записей аудита нет.</p>}
          {auditEntries?.map((entry) => (
            <div key={entry.id} className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{new Date(entry.createdAt).toLocaleString("ru-RU")}</span>
              <span>{entry.action}</span>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent>
          <DialogTitle>Закрытие обращения</DialogTitle>
          <DialogDescription>Закрытие требует итогового ответа автору (FR-WF-005).</DialogDescription>
          <Textarea rows={4} value={finalAnswer} onChange={(e) => setFinalAnswer(e.target.value)} className="mt-4" />
          {appeal.type === "RESIGNATION" && (
            <div className="mt-4 flex flex-col gap-1">
              <Label>Исход</Label>
              <Select
                value={resignationOutcome}
                onValueChange={(v) => setResignationOutcome(v as ResignationOutcome)}
              >
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
    </div>
  );
}
