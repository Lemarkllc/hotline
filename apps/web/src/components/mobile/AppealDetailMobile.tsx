import { useState } from "react";
import { ChevronLeft, Download, Lock, Paperclip, Send, ShieldAlert } from "lucide-react";
import { APPEAL_STATUS_LABELS, type AppealStatus } from "@hotline/shared";
import { cn } from "@/lib/utils";
import { statusColor, APPEAL_TYPE_LABELS } from "@/components/appeals/badges";
import { MentionTextarea } from "@/components/appeals/MentionTextarea";
import { BottomSheet, BottomSheetContent, BottomSheetTitle, BottomSheetTrigger } from "@/components/ui/bottom-sheet";
import type { AppealDTO } from "@/hooks/api";

type DetailTab = "appeal" | "messages" | "internal" | "attachments";

const TAB_LABELS: Record<DetailTab, string> = {
  appeal: "Обращение",
  messages: "Переписка",
  internal: "Внутр. работа",
  attachments: "Вложения",
};

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function AppealDetailMobile({
  appeal,
  onBack,
  activeTab,
  onTabChange,
  unreadTabs,
  availableTransitions,
  canClose,
  canClassify: _canClassify,
  canAssign,
  canReadAuthor,
  revealedAuthor,
  onRevealClick,
  onTransitionClick,
  transitionPending,
  managers,
  onAssign,
  workingEdit,
  onWorkingEditChange,
  onSaveWorkingEdit,
  saveWorkingEditPending,
  newMessage,
  onNewMessageChange,
  onSendMessage,
  sendPending,
  newInternalNote,
  onNewInternalNoteChange,
  mentionableUsers,
  mentionedUserIds,
  onMentionedUserIdsChange,
  onAddInternalNote,
  addNotePending,
  onDownloadAttachment,
}: {
  appeal: AppealDTO;
  onBack: () => void;
  activeTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  unreadTabs: { messages: boolean; internal: boolean };
  availableTransitions: AppealStatus[];
  canClose: boolean;
  canClassify: boolean;
  canAssign: boolean;
  canReadAuthor: boolean;
  revealedAuthor: { id: string; fullName: string } | null;
  onRevealClick: () => void;
  onTransitionClick: (status: AppealStatus) => void;
  transitionPending: boolean;
  managers?: { id: string; fullName: string }[];
  onAssign: (userId: string) => void;
  workingEdit: string;
  onWorkingEditChange: (v: string) => void;
  onSaveWorkingEdit: () => void;
  saveWorkingEditPending: boolean;
  newMessage: string;
  onNewMessageChange: (v: string) => void;
  onSendMessage: () => void;
  sendPending: boolean;
  newInternalNote: string;
  onNewInternalNoteChange: (v: string) => void;
  mentionableUsers?: { id: string; fullName: string }[];
  mentionedUserIds: string[];
  onMentionedUserIdsChange: (ids: string[]) => void;
  onAddInternalNote: () => void;
  addNotePending: boolean;
  onDownloadAttachment: (attachmentId: string) => void;
}) {
  const [assignSheetOpen, setAssignSheetOpen] = useState(false);

  return (
    <div className="fixed inset-0 z-20 flex animate-in slide-in-from-right flex-col bg-background duration-300">
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-border bg-background px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3">
        <button onClick={onBack} className="mt-0.5 flex size-8 shrink-0 items-center justify-center">
          <ChevronLeft className="size-6 text-foreground" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-bold text-foreground">{appeal.publicNumber}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
              style={{ background: statusColor(appeal.status) }}
            >
              {APPEAL_STATUS_LABELS[appeal.status]}
            </span>
            <span className="text-[13px] text-muted-foreground">{APPEAL_TYPE_LABELS[appeal.type] ?? appeal.type}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {availableTransitions.map((s) => (
            <button
              key={s}
              disabled={(s === "CLOSED" && !canClose) || transitionPending}
              onClick={() => onTransitionClick(s)}
              className="whitespace-nowrap rounded-full bg-[#EFF6FF] px-3 py-1.5 text-[12px] font-semibold text-primary disabled:opacity-50"
            >
              → {APPEAL_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
        {/* Author card */}
        <button
          type="button"
          onClick={appeal.isAuthorHidden && !revealedAuthor && appeal.canRevealAuthor ? onRevealClick : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-[16px] border p-4 text-left",
            appeal.mode === "CONFIDENTIAL" ? "border-confidential" : "border-border",
          )}
        >
          {appeal.isAuthorHidden ? (
            <>
              <Lock className="size-5 shrink-0 text-confidential" />
              <div>
                <p className="text-[14px] font-bold text-confidential">
                  {revealedAuthor ? revealedAuthor.fullName : "Автор скрыт (конфиденциально)"}
                </p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {revealedAuthor
                    ? "Автор раскрыт для этого просмотра — действие в аудите."
                    : appeal.canRevealAuthor
                      ? "Нажмите, чтобы раскрыть — потребует пароль, действие в аудите"
                      : "Доступно только HRD и Администратору"}
                </p>
              </div>
            </>
          ) : (
            <>
              <ShieldAlert className="size-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-[14px] font-bold text-foreground">{appeal.author?.fullName ?? "Автор не указан"}</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">Автор обращения</p>
              </div>
            </>
          )}
        </button>

        {/* Segmented tabs — фикс бага прототипа: полная ширина без клиппинга последнего сегмента. */}
        <div className="mt-4 grid grid-cols-4 gap-0.5 rounded-[10px] bg-[#F1F5F9] p-[3px]">
          {(Object.keys(TAB_LABELS) as DetailTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={cn(
                "relative rounded-[8px] px-1 py-2 text-center text-[12px] font-semibold leading-tight",
                activeTab === tab
                  ? "bg-white text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.12)]"
                  : "text-muted-foreground",
              )}
            >
              {TAB_LABELS[tab]}
              {((tab === "messages" && unreadTabs.messages) || (tab === "internal" && unreadTabs.internal)) && (
                <span className="absolute right-1.5 top-1.5 size-[5px] rounded-full bg-destructive" />
              )}
            </button>
          ))}
        </div>

        {/* Обращение */}
        {activeTab === "appeal" && (
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Оригинальный текст
              </p>
              <div className="rounded-[16px] border border-border bg-surface p-4">
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground">{appeal.originalText}</p>
              </div>
            </div>

            {canReadAuthor && (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Рабочая редакция
                </p>
                <div className="rounded-[16px] border border-border bg-surface p-4">
                  <textarea
                    rows={3}
                    defaultValue={appeal.workingEdit ?? ""}
                    onChange={(e) => onWorkingEditChange(e.target.value)}
                    placeholder="Необязательно — обезличенная формулировка без деталей, раскрывающих автора"
                    className="w-full resize-none border-none bg-transparent text-[16px] text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                  <button
                    disabled={!workingEdit.trim() || saveWorkingEditPending}
                    onClick={onSaveWorkingEdit}
                    className="mt-2 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            )}

            {appeal.rating && (
              <div className="rounded-[16px] border border-border bg-surface p-4 text-[14px] text-foreground">
                {appeal.rating.score !== null ? (
                  <>
                    Оценка автора: <span className="font-bold">{appeal.rating.score}/5</span>
                    {appeal.rating.comment && (
                      <p className="mt-1 text-[13px] text-muted-foreground">{appeal.rating.comment}</p>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col gap-1">
                    <span>
                      Порекомендовал(а) бы нас: <span className="font-bold">{appeal.rating.wouldRecommendScore}/5</span>
                    </span>
                    <span>
                      Обратится ли снова: <span className="font-bold">{appeal.rating.wouldReturnScore}/5</span>
                    </span>
                  </div>
                )}
              </div>
            )}

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Ответственный
              </p>
              <div className="flex items-center gap-3 rounded-[16px] border border-border bg-surface p-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background text-[13px] font-bold text-muted-foreground">
                  {appeal.assignees[0] ? initials(appeal.assignees[0].fullName) : "?"}
                </div>
                <span className="flex-1 text-[14px] text-foreground">
                  {appeal.assignees.map((a) => a.fullName).join(", ") || "Не назначен"}
                </span>
                {canAssign && (
                  <BottomSheet open={assignSheetOpen} onOpenChange={setAssignSheetOpen}>
                    <BottomSheetTrigger asChild>
                      <button className="shrink-0 rounded-full bg-[#EFF6FF] px-3.5 py-1.5 text-[13px] font-semibold text-primary">
                        {appeal.assignees.length ? "Изменить" : "Назначить"}
                      </button>
                    </BottomSheetTrigger>
                    <BottomSheetContent>
                      <BottomSheetTitle className="px-5 pb-1 pt-3 text-[15px] font-bold text-foreground">
                        Назначить ответственного
                      </BottomSheetTitle>
                      <div className="flex flex-col gap-1 px-3 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-2">
                        {!managers?.length && (
                          <p className="px-2 py-4 text-center text-[13px] text-muted-foreground">
                            Нет доступных сотрудников.
                          </p>
                        )}
                        {managers?.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => {
                              onAssign(m.id);
                              setAssignSheetOpen(false);
                            }}
                            className="flex items-center gap-3 rounded-[12px] px-3 py-3 text-left active:bg-background"
                          >
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background text-[13px] font-bold text-muted-foreground">
                              {initials(m.fullName)}
                            </span>
                            <span className="text-[14px] text-foreground">{m.fullName}</span>
                          </button>
                        ))}
                      </div>
                    </BottomSheetContent>
                  </BottomSheet>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Переписка */}
        {activeTab === "messages" && (
          <div className="mt-4 flex flex-col gap-3">
            {!appeal.messages.length && (
              <p className="py-6 text-center text-[13px] text-muted-foreground">Переписки пока нет.</p>
            )}
            {appeal.messages.map((m) => (
              <div key={m.id} className={cn("flex", m.fromHrd ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-[16px] p-3 text-[14px]",
                    m.fromHrd ? "bg-[#DBEAFE] text-foreground" : "border border-border bg-surface text-foreground",
                  )}
                >
                  <p className="leading-relaxed">{m.text}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {m.fromHrd ? (m.fromFullName ?? "Сотрудник") : (appeal.author?.fullName ?? "Автор")} ·{" "}
                    {new Date(m.createdAt).toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Внутренняя работа */}
        {activeTab === "internal" && (
          <div className="mt-4 flex flex-col gap-3">
            {!appeal.comments.filter((c) => c.visibility === "INTERNAL").length && (
              <p className="py-6 text-center text-[13px] text-muted-foreground">Внутренних заметок пока нет.</p>
            )}
            {appeal.comments
              .filter((c) => c.visibility === "INTERNAL")
              .map((c) => (
                <div key={c.id} className="rounded-[16px] bg-[#F1F5F9] p-3 text-[14px] text-foreground">
                  <p className="leading-relaxed">{c.text}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {c.authorFullName} · {new Date(c.createdAt).toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))}
          </div>
        )}

        {/* Вложения */}
        {activeTab === "attachments" && (
          <div className="mt-4 flex flex-col gap-2">
            {!appeal.attachments.length && (
              <p className="py-6 text-center text-[13px] text-muted-foreground">Вложений нет.</p>
            )}
            {appeal.attachments.map((a) => (
              <button
                key={a.id}
                onClick={() => onDownloadAttachment(a.id)}
                className="flex items-center gap-2.5 rounded-[14px] border border-border bg-surface px-4 py-3.5 text-left"
              >
                <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-[14px] text-foreground">
                  {a.kind === "PHOTO" ? "Фото" : "Видео"}
                </span>
                <span className="shrink-0 text-[12px] text-muted-foreground">
                  {(a.fileSize / 1024 / 1024).toFixed(1)} МБ
                </span>
                <Download className="size-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Fixed input bar — только для Переписка/Внутр. работа, как в прототипе. */}
      {activeTab === "messages" && (
        <div className="flex items-center gap-2 border-t border-border bg-surface p-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <input
            value={newMessage}
            onChange={(e) => onNewMessageChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSendMessage();
              }
            }}
            placeholder="Написать автору..."
            className="h-11 flex-1 rounded-full border border-border bg-background px-4 text-[16px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            disabled={!newMessage.trim() || sendPending}
            onClick={onSendMessage}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
          >
            <Send className="size-4" />
          </button>
        </div>
      )}
      {activeTab === "internal" && (
        <div className="flex items-end gap-2 border-t border-border bg-surface p-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <div className="flex-1 rounded-[18px] border border-border bg-background px-3 py-2">
            <MentionTextarea
              rows={1}
              placeholder="Заметка коллегам, @упомянуть..."
              value={newInternalNote}
              onChange={onNewInternalNoteChange}
              users={mentionableUsers ?? []}
              mentionedUserIds={mentionedUserIds}
              onMentionedUserIdsChange={onMentionedUserIdsChange}
              onSubmit={onAddInternalNote}
              className="min-h-0 border-none bg-transparent p-0 text-[16px] focus-visible:ring-0"
            />
          </div>
          <button
            disabled={!newInternalNote.trim() || addNotePending}
            onClick={onAddInternalNote}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-foreground text-white disabled:opacity-50"
          >
            <Send className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
