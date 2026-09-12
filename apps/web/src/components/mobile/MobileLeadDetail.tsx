import { useRef } from "react";
import { ChevronLeft, Clock, Send } from "lucide-react";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@hotline/shared";
import { AttachmentGallery } from "@/components/attachments/AttachmentGallery";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "./PullToRefreshIndicator";
import type { LeadDTO } from "@/hooks/api";

const STATUS_COLOR: Record<LeadStatus, string> = {
  NEW: "#4A5568",
  IN_PROGRESS: "#96631A",
  CONVERTED: "#2F6B4F",
  STOP_LISTED: "#C20F1A",
};

const SLA_TOTAL_MS = 4 * 60 * 60 * 1000;

/** Тот же SLA-расчёт, что и в десктопном SlaBlock (LeadDetailPage.tsx) — не поле в
 * БД, вычисляется из firstResponseDueAt/firstRespondedAt. Раньше на мобиле карточка
 * лида вообще не показывала SLA (сама страница не имела мобильной ветки) — прогон
 * impeccable поймал, что просроченный лид на телефоне выглядел как обычный "Новая",
 * хотя роль «Продажи» работает преимущественно с телефона. */
function SlaBlock({ lead }: { lead: LeadDTO }) {
  const isActive = lead.status === "NEW" || lead.status === "IN_PROGRESS";
  if (!isActive || lead.firstRespondedAt) return null;

  const dueAt = new Date(lead.firstResponseDueAt).getTime();
  const now = Date.now();
  const overdueMs = now - dueAt;

  if (overdueMs > 0) {
    const hours = Math.floor(overdueMs / 3_600_000);
    const minutes = Math.floor((overdueMs % 3_600_000) / 60_000);
    return (
      <div className="flex items-start gap-2 rounded-lg border border-status-overdue/35 bg-status-overdue-tint p-3.5">
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
    <div className="rounded-lg border border-rule bg-surface p-3.5">
      <p className="font-mono text-meta font-medium text-status-review">
        осталось {hours} ч {minutes} мин
      </p>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-sunk">
        <div className="h-full rounded-full bg-status-review" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}

export function MobileLeadDetail({
  lead,
  onBack,
  onStopList,
  stopListPending,
  onConvertClick,
  onRestore,
  restorePending,
  replyText,
  onReplyTextChange,
  onSendReply,
  sendReplyPending,
  getAttachmentQueryKey,
  fetchAttachmentUrl,
}: {
  lead: LeadDTO;
  onBack: () => void;
  onStopList: () => void;
  stopListPending: boolean;
  onConvertClick: () => void;
  onRestore: () => void;
  restorePending: boolean;
  replyText: string;
  onReplyTextChange: (v: string) => void;
  onSendReply: () => void;
  sendReplyPending: boolean;
  getAttachmentQueryKey: (attachmentId: string) => unknown[];
  fetchAttachmentUrl: (attachmentId: string, download?: boolean) => Promise<string>;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const { pullDistance, refreshing, threshold } = usePullToRefresh(contentRef);

  return (
    <div className="fixed inset-0 z-20 flex animate-in slide-in-from-right flex-col bg-ground duration-3">
      <div className="flex items-start gap-3 border-b border-rule bg-ground px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3">
        <button onClick={onBack} className="mt-0.5 flex size-8 shrink-0 items-center justify-center active:opacity-60">
          <ChevronLeft className="size-6 text-text-1" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-ui font-semibold text-text-1">{lead.publicNumber}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-0.5 text-label font-semibold text-white"
              style={{ background: STATUS_COLOR[lead.status] }}
            >
              {LEAD_STATUS_LABELS[lead.status]}
            </span>
            <span className="text-meta text-text-3">Почта</span>
          </div>
        </div>
      </div>

      <div ref={contentRef} className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
        <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} threshold={threshold} />

        <h1 className="text-ui font-semibold leading-snug text-text-1">{lead.subject}</h1>
        <p className="mt-1 font-mono text-meta text-text-3">
          {lead.fromEmail} · {new Date(lead.createdAt).toLocaleString("ru-RU")}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {(lead.status === "NEW" || lead.status === "IN_PROGRESS") && (
            <>
              <button
                disabled={stopListPending}
                onClick={onStopList}
                className="flex h-touch items-center rounded-full bg-surface-sunk px-4 text-meta font-semibold text-text-1 disabled:opacity-50 active:opacity-70"
              >
                В стоп-лист
              </button>
              <button
                onClick={onConvertClick}
                className="flex h-touch items-center rounded-full bg-action px-4 text-meta font-semibold text-action-fg active:opacity-90"
              >
                Передать в CRM
              </button>
            </>
          )}
          {lead.status === "STOP_LISTED" && (
            <button
              disabled={restorePending}
              onClick={onRestore}
              className="flex h-touch items-center rounded-full bg-surface-sunk px-4 text-meta font-semibold text-text-1 disabled:opacity-50 active:opacity-70"
            >
              Вернуть в работу
            </button>
          )}
        </div>

        <div className="mt-4">
          <SlaBlock lead={lead} />
        </div>

        {lead.bitrixAssignee && (
          <div className="mt-4">
            <p className="mb-2 font-mono text-label font-medium uppercase tracking-wide text-text-3">
              Ответственный в Bitrix24
            </p>
            <div className="rounded-lg border border-rule bg-surface p-4">
              <p className="text-ui text-text-1">{lead.bitrixAssignee.name}</p>
              {lead.bitrixAssignee.email && <p className="mt-0.5 text-meta text-text-3">{lead.bitrixAssignee.email}</p>}
              {lead.autoAssignReason && (
                <p className="mt-0.5 text-meta text-text-3">Авто-назначение: {lead.autoAssignReason}</p>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3">
          {lead.messages.map((m) =>
            m.direction === "OUTBOUND" ? (
              <div key={m.id} className="ml-auto flex max-w-[88%] flex-col items-end gap-1">
                <div className="rounded-[12px_12px_4px_12px] bg-action px-3.5 py-2.5 text-ui text-action-fg">
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </div>
                <p className="font-mono text-label text-text-3">
                  {m.sentBy?.fullName ?? "Сотрудник"} · {new Date(m.receivedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ) : (
              <div key={m.id} className="flex flex-col gap-1 rounded-lg border border-rule bg-surface p-3.5">
                <div className="flex items-center justify-between text-meta text-text-3">
                  <span className="truncate">{m.fromEmail}</span>
                  <span className="shrink-0">{new Date(m.receivedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <p className="whitespace-pre-wrap text-ui text-text-1">{m.body}</p>
                {Boolean(m.attachments.length) && (
                  <AttachmentGallery
                    attachments={m.attachments.map((a) => ({
                      id: a.id,
                      mimeType: a.mimeType,
                      fileSize: a.fileSize,
                      label: a.filename,
                    }))}
                    getQueryKey={getAttachmentQueryKey}
                    fetchUrl={fetchAttachmentUrl}
                  />
                )}
              </div>
            ),
          )}
          {!lead.messages.length && <p className="py-6 text-center text-meta text-text-3">Переписки пока нет.</p>}
        </div>
      </div>

      {/* Композер — вне скролл-контейнера, внутри fixed inset-0 z-20 оверлея, поэтому
       * реальный таб-бар не рендерится вовсе (см. MobileShell DETAIL_ROUTE), а не
       * перекрывается им, как было раньше на десктопной вёрстке этой страницы. */}
      {lead.status !== "STOP_LISTED" && (
        <div className="flex items-end gap-2 border-t border-rule bg-surface p-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <textarea
            rows={1}
            value={replyText}
            onChange={(e) => onReplyTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSendReply();
              }
            }}
            placeholder="Ответить клиенту..."
            // text-[16px], не text-ui (14px) — iOS Safari сам зумит страницу при фокусе
            // на поле мельче 16px (тот же гочтя, что и в ChangePasswordPage/LoginPage,
            // здесь раньше был пропущен — прогон impeccable это поймал).
            className="max-h-28 min-h-touch flex-1 resize-none rounded-[18px] border border-rule-strong bg-ground px-4 py-3 text-[16px] text-text-1 placeholder:text-text-3 focus:outline-none"
          />
          <button
            disabled={!replyText.trim() || sendReplyPending}
            onClick={onSendReply}
            className="flex size-touch shrink-0 items-center justify-center rounded-full bg-action text-action-fg disabled:opacity-50 active:opacity-90"
          >
            <Send className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
