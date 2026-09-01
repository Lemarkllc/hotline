import { useRef, useState } from "react";
import { ChevronLeft, Lock, Send, ShieldAlert } from "lucide-react";
import { APPEAL_STATUS_LABELS, type AppealStatus } from "@hotline/shared";
import { cn } from "@/lib/utils";
import { statusColor, APPEAL_TYPE_LABELS } from "@/components/appeals/badges";
import { MentionTextarea } from "@/components/appeals/MentionTextarea";
import { AttachmentGallery } from "@/components/attachments/AttachmentGallery";
import { BottomSheet, BottomSheetContent, BottomSheetTitle, BottomSheetTrigger } from "@/components/ui/bottom-sheet";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "./PullToRefreshIndicator";
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
  getAttachmentQueryKey,
  fetchAttachmentUrl,
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
  getAttachmentQueryKey: (attachmentId: string) => unknown[];
  fetchAttachmentUrl: (attachmentId: string, download?: boolean) => Promise<string>;
}) {
  const [assignSheetOpen, setAssignSheetOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const { pullDistance, refreshing, threshold } = usePullToRefresh(contentRef);

  return (
    <div className="fixed inset-0 z-20 flex animate-in slide-in-from-right flex-col bg-ground duration-3">
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-rule bg-ground px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3">
        <button onClick={onBack} className="mt-0.5 flex size-8 shrink-0 items-center justify-center active:opacity-60">
          <ChevronLeft className="size-6 text-text-1" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-ui font-semibold text-text-1">{appeal.publicNumber}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-0.5 text-label font-semibold text-white"
              style={{ background: statusColor(appeal.status) }}
            >
              {APPEAL_STATUS_LABELS[appeal.status]}
            </span>
            <span className="text-meta text-text-3">{APPEAL_TYPE_LABELS[appeal.type] ?? appeal.type}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {availableTransitions.map((s) => (
            <button
              key={s}
              disabled={(s === "CLOSED" && !canClose) || transitionPending}
              onClick={() => onTransitionClick(s)}
              className="whitespace-nowrap rounded-full bg-surface-sunk px-3 py-1.5 text-label font-semibold text-text-1 disabled:opacity-50 active:opacity-70"
            >
              → {APPEAL_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div ref={contentRef} className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
        <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} threshold={threshold} />
        {/* Author card */}
        <button
          type="button"
          onClick={appeal.isAuthorHidden && !revealedAuthor && appeal.canRevealAuthor ? onRevealClick : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg border p-4 text-left active:bg-surface-sunk",
            appeal.mode === "CONFIDENTIAL" ? "border-confidential/40" : "border-rule",
          )}
        >
          {appeal.isAuthorHidden ? (
            <>
              <Lock className="size-5 shrink-0 text-confidential" />
              <div>
                <p className="text-ui font-semibold text-confidential">
                  {revealedAuthor ? revealedAuthor.fullName : "Автор скрыт (конфиденциально)"}
                </p>
                <p className="mt-0.5 text-meta text-text-3">
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
              <ShieldAlert className="size-5 shrink-0 text-text-3" />
              <div>
                <p className="text-ui font-semibold text-text-1">{appeal.author?.fullName ?? "Автор не указан"}</p>
                <p className="mt-0.5 text-meta text-text-3">Автор обращения</p>
              </div>
            </>
          )}
        </button>

        {/* Segmented tabs — фикс бага прототипа: полная ширина без клиппинга последнего сегмента. */}
        <div className="mt-4 grid grid-cols-4 gap-0.5 rounded-lg bg-surface-sunk p-[3px]">
          {(Object.keys(TAB_LABELS) as DetailTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={cn(
                "relative rounded-md px-1 py-2 text-center text-label font-semibold leading-tight",
                activeTab === tab ? "bg-surface text-text-1 shadow-1" : "text-text-3",
              )}
            >
              {TAB_LABELS[tab]}
              {((tab === "messages" && unreadTabs.messages) || (tab === "internal" && unreadTabs.internal)) && (
                <span className="absolute right-1.5 top-1.5 size-[5px] rounded-full bg-status-overdue" />
              )}
            </button>
          ))}
        </div>

        {/* Обращение */}
        {activeTab === "appeal" && (
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <p className="mb-2 font-mono text-label font-medium uppercase tracking-wide text-text-3">
                Оригинальный текст
              </p>
              <div className="rounded-lg border border-rule bg-surface p-4">
                <p className="whitespace-pre-wrap text-ui leading-relaxed text-text-1">{appeal.originalText}</p>
              </div>
            </div>

            {canReadAuthor && (
              <div>
                <p className="mb-2 font-mono text-label font-medium uppercase tracking-wide text-text-3">
                  Рабочая редакция
                </p>
                <div className="rounded-lg border border-rule bg-surface p-4">
                  <textarea
                    rows={3}
                    defaultValue={appeal.workingEdit ?? ""}
                    onChange={(e) => onWorkingEditChange(e.target.value)}
                    placeholder="Необязательно — обезличенная формулировка без деталей, раскрывающих автора"
                    className="w-full resize-none border-none bg-transparent text-[16px] text-text-1 placeholder:text-text-3 focus:outline-none"
                  />
                  <button
                    disabled={!workingEdit.trim() || saveWorkingEditPending}
                    onClick={onSaveWorkingEdit}
                    className="mt-2 rounded-full bg-action px-4 py-2 text-meta font-semibold text-action-fg disabled:opacity-50 active:opacity-90"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            )}

            {appeal.rating && (
              <div className="rounded-lg border border-rule bg-surface p-4 text-ui text-text-1">
                {appeal.rating.score !== null ? (
                  <>
                    Оценка автора: <span className="font-semibold">{appeal.rating.score}/5</span>
                    {appeal.rating.comment && (
                      <p className="mt-1 text-meta text-text-3">{appeal.rating.comment}</p>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col gap-1">
                    <span>
                      Порекомендовал(а) бы нас: <span className="font-semibold">{appeal.rating.wouldRecommendScore}/5</span>
                    </span>
                    <span>
                      Обратится ли снова: <span className="font-semibold">{appeal.rating.wouldReturnScore}/5</span>
                    </span>
                  </div>
                )}
              </div>
            )}

            <div>
              <p className="mb-2 font-mono text-label font-medium uppercase tracking-wide text-text-3">
                Ответственный
              </p>
              <div className="flex items-center gap-3 rounded-lg border border-rule bg-surface p-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-sunk font-mono text-meta font-medium text-text-2">
                  {appeal.assignees[0] ? initials(appeal.assignees[0].fullName) : "?"}
                </div>
                <span className="flex-1 text-ui text-text-1">
                  {appeal.assignees.map((a) => a.fullName).join(", ") || "Не назначен"}
                </span>
                {canAssign && (
                  <BottomSheet open={assignSheetOpen} onOpenChange={setAssignSheetOpen}>
                    <BottomSheetTrigger asChild>
                      <button className="shrink-0 rounded-full bg-surface-sunk px-3.5 py-1.5 text-meta font-semibold text-text-1 active:opacity-70">
                        {appeal.assignees.length ? "Изменить" : "Назначить"}
                      </button>
                    </BottomSheetTrigger>
                    <BottomSheetContent>
                      <BottomSheetTitle className="px-5 pb-1 pt-3 text-ui font-semibold text-text-1">
                        Назначить ответственного
                      </BottomSheetTitle>
                      <div className="flex flex-col gap-1 px-3 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-2">
                        {!managers?.length && (
                          <p className="px-2 py-4 text-center text-meta text-text-3">
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
                            className="flex min-h-touch items-center gap-3 rounded-md px-3 py-3 text-left active:bg-surface-sunk"
                          >
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-sunk font-mono text-meta font-medium text-text-2">
                              {initials(m.fullName)}
                            </span>
                            <span className="text-ui text-text-1">{m.fullName}</span>
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
              <p className="py-6 text-center text-meta text-text-3">Переписки пока нет.</p>
            )}
            {appeal.messages.map((m) => (
              <div key={m.id} className={cn("flex", m.fromHrd ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] p-3 text-ui",
                    m.fromHrd
                      ? "rounded-[12px_12px_4px_12px] bg-action text-action-fg"
                      : "rounded-[12px_12px_12px_4px] border border-rule bg-surface text-text-1",
                  )}
                >
                  <p className="leading-relaxed">{m.text}</p>
                  <p className={cn("mt-1 font-mono text-label", m.fromHrd ? "text-action-fg/70" : "text-text-3")}>
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
              <p className="py-6 text-center text-meta text-text-3">Внутренних заметок пока нет.</p>
            )}
            {appeal.comments
              .filter((c) => c.visibility === "INTERNAL")
              .map((c) => (
                <div key={c.id} className="border-l-2 border-status-review bg-surface-sunk p-3 text-ui text-text-1">
                  <p className="leading-relaxed">{c.text}</p>
                  <p className="mt-1 font-mono text-label text-text-3">
                    {c.authorFullName} · {new Date(c.createdAt).toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))}
          </div>
        )}

        {/* Вложения — та же галерея с превью в диалоге, что и на desktop (не список
            "нажал → сразу скачивание", там фото вообще было нельзя посмотреть). */}
        {activeTab === "attachments" && (
          <div className="mt-4">
            <AttachmentGallery
              attachments={appeal.attachments.map((a) => ({
                id: a.id,
                mimeType: a.mimeType,
                fileSize: a.fileSize,
                label: a.kind === "PHOTO" ? "Фото" : "Видео",
              }))}
              getQueryKey={getAttachmentQueryKey}
              fetchUrl={fetchAttachmentUrl}
            />
          </div>
        )}
      </div>

      {/* Fixed input bar — только для Переписка/Внутр. работа, как в прототипе. */}
      {activeTab === "messages" && (
        <div className="flex items-center gap-2 border-t border-rule bg-surface p-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
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
            className="h-touch flex-1 rounded-full border border-rule-strong bg-ground px-4 text-[16px] text-text-1 placeholder:text-text-3 focus:outline-none"
          />
          <button
            disabled={!newMessage.trim() || sendPending}
            onClick={onSendMessage}
            className="flex size-touch shrink-0 items-center justify-center rounded-full bg-action text-action-fg disabled:opacity-50 active:opacity-90"
          >
            <Send className="size-4" />
          </button>
        </div>
      )}
      {activeTab === "internal" && (
        <div className="flex items-end gap-2 border-t border-status-review bg-surface p-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <div className="flex-1 rounded-[18px] border border-rule-strong bg-ground px-3 py-2">
            <MentionTextarea
              rows={1}
              placeholder="Заметка коллегам, @упомянуть..."
              value={newInternalNote}
              onChange={onNewInternalNoteChange}
              users={mentionableUsers ?? []}
              mentionedUserIds={mentionedUserIds}
              onMentionedUserIdsChange={onMentionedUserIdsChange}
              onSubmit={onAddInternalNote}
              className="min-h-0 border-none bg-transparent p-0 text-[16px] focus-visible:outline-none"
            />
          </div>
          <button
            disabled={!newInternalNote.trim() || addNotePending}
            onClick={onAddInternalNote}
            className="flex size-touch shrink-0 items-center justify-center rounded-full bg-status-review text-white disabled:opacity-50 active:opacity-90"
          >
            <Send className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
