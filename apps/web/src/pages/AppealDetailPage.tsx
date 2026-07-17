import { useState } from "react";
import { useParams } from "react-router-dom";
import { Download, EyeOff, Paperclip, ShieldAlert } from "lucide-react";
import {
  APPEAL_STATUS_LABELS,
  APPEAL_STATUS_TRANSITIONS,
  type AppealStatus,
} from "@hotline/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { ModeBadge, StatusBadge, TypeLabel } from "@/components/appeals/badges";
import {
  useAddComment,
  useAppeal,
  useAssignAppeal,
  useAttachmentUrl,
  useAuditLog,
  useChangeStatus,
  useEpics,
  useSetEpic,
  useSetWorkingEdit,
  useAssignableUsers,
} from "@/hooks/api";
import { useAuthStore } from "@/lib/authStore";

export function AppealDetailPage() {
  const { id = "" } = useParams();
  const { data: appeal, isLoading } = useAppeal(id);
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [finalAnswer, setFinalAnswer] = useState("");
  const [workingEdit, setWorkingEdit] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newInternalNote, setNewInternalNote] = useState("");

  const canReadAuthor = hasPermission("appeal.read_author");
  const canClassify = hasPermission("appeal.read_all");
  const canAssign = hasPermission("appeal.assign");
  const canClose = hasPermission("appeal.close");
  const canReadAudit = hasPermission("audit.read");

  const changeStatus = useChangeStatus(id);
  const setWorkingEditMutation = useSetWorkingEdit(id);
  const setEpicMutation = useSetEpic(id);
  const assignMutation = useAssignAppeal(id);
  const addComment = useAddComment(id);
  const { data: epics } = useEpics("EMPLOYEE");
  // enabled: без permission эти запросы гарантированно вернут 403 — не дёргаем их зря.
  const { data: managers } = useAssignableUsers("EMPLOYEE", canAssign);
  const { data: auditEntries } = useAuditLog({ appealId: id }, canReadAudit);
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
            <>
              <EyeOff className="size-5 text-confidential" />
              <div>
                <p className="text-sm font-medium text-confidential">Автор скрыт (конфиденциальный режим)</p>
                <p className="text-xs text-muted-foreground">
                  Данные автора доступны только HRD; каждый просмотр журналируется.
                </p>
              </div>
            </>
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

      <Tabs defaultValue="appeal">
        <TabsList>
          <TabsTrigger value="appeal">Обращение</TabsTrigger>
          <TabsTrigger value="messages">Переписка</TabsTrigger>
          <TabsTrigger value="internal">Внутренняя работа</TabsTrigger>
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
                Оценка автора: <span className="font-semibold tabular-nums">{appeal.rating.score}/5</span>
                {appeal.rating.comment && <p className="mt-1 text-muted-foreground">{appeal.rating.comment}</p>}
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
                {m.fromHrd ? "HRD" : "Автор"} · {new Date(m.createdAt).toLocaleString("ru-RU")}
              </p>
            </div>
          ))}
          {!appeal.messages.length && <p className="text-sm text-muted-foreground">Переписки пока нет.</p>}
          <div className="mt-2 flex gap-2">
            <Textarea
              rows={2}
              placeholder="Написать автору (например, запросить уточнение)..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
            />
            <Button
              disabled={!newMessage.trim() || addComment.isPending}
              onClick={async () => {
                await addComment.mutateAsync({ text: newMessage, visibility: "PUBLIC" });
                setNewMessage("");
              }}
            >
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
                <p className="mt-1 text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString("ru-RU")}</p>
              </div>
            ))}
          <div className="mt-2 flex gap-2">
            <Textarea
              rows={2}
              placeholder="Внутренняя заметка (не видна автору)..."
              value={newInternalNote}
              onChange={(e) => setNewInternalNote(e.target.value)}
            />
            <Button
              disabled={!newInternalNote.trim() || addComment.isPending}
              onClick={async () => {
                await addComment.mutateAsync({ text: newInternalNote, visibility: "INTERNAL" });
                setNewInternalNote("");
              }}
            >
              Добавить
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="attachments" className="flex flex-col gap-2">
          {!appeal.attachments.length && <p className="text-sm text-muted-foreground">Вложений нет.</p>}
          {appeal.attachments.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center gap-2">
                <Paperclip className="size-4 text-muted-foreground" />
                <span>{a.kind === "PHOTO" ? "Фото" : "Видео"}</span>
                <span className="text-muted-foreground">{(a.fileSize / 1024 / 1024).toFixed(1)} МБ</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleDownload(a.id)}>
                <Download className="size-4" /> Открыть
              </Button>
            </div>
          ))}
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>
              Отменить
            </Button>
            <Button
              disabled={!finalAnswer.trim() || changeStatus.isPending}
              onClick={async () => {
                await changeStatus.mutateAsync({ toStatus: "CLOSED", finalAnswer });
                setCloseDialogOpen(false);
                setFinalAnswer("");
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
