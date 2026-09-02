import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@hotline/shared";
import { cn } from "@/lib/utils";
import { MobileDateRangePicker } from "@/components/ui/date-range-picker/MobileDateRangePicker";
import type { LeadConversionStats, LeadDTO, LeadsView } from "@/hooks/api";

const CHIPS: { label: string; value: LeadsView }[] = [
  { label: "Активные", value: "active" },
  { label: "В CRM", value: "converted" },
  { label: "Стоп-лист", value: "stop_listed" },
];

/** Те же status-* токены, что и на десктопе (LeadsPage.tsx: NEW→open, IN_PROGRESS→
 * review, CONVERTED→closed, STOP_LISTED→overdue) — литерал, не CSS-переменная,
 * тем же принципом, что и statusColor() в components/appeals/badges.tsx. */
const STATUS_COLOR: Record<LeadStatus, string> = {
  NEW: "#4A5568",
  IN_PROGRESS: "#96631A",
  CONVERTED: "#2F6B4F",
  STOP_LISTED: "#C20F1A",
};

/** SLA — не поле в БД, вычисляется из firstResponseDueAt/firstRespondedAt (leadService),
 * тот же расчёт, что и isOverdue() в LeadsPage.tsx (десктоп). Раньше на мобиле это
 * поле вообще не читалось — просроченный лид выглядел как обычный "Новая", хотя
 * роль «Продажи» по брифу работает преимущественно с телефона (прогон impeccable). */
function isOverdue(lead: LeadDTO): boolean {
  if (lead.status !== "NEW" && lead.status !== "IN_PROGRESS") return false;
  if (lead.firstRespondedAt) return false;
  return new Date(lead.firstResponseDueAt).getTime() < Date.now();
}

/** Плитки статистики за выбранный период — тот же 2×2 паттерн, что и у
 * MobileDashboard.tsx (крупная цифра + подпись), без графика по дням: recharts на
 * телефоне не нужен, тот же принцип, что и у MobileDashboard (см. его комментарий). */
const STAT_CARDS: { key: keyof LeadConversionStats; label: string; color: string; suffix?: string }[] = [
  { key: "total", label: "Всего заявок", color: "#6E6C68" },
  { key: "converted", label: "Передано в CRM", color: "#2F6B4F" },
  { key: "aiRelevant", label: "Качественных (ИИ)", color: "#96631A" },
];

/** Мобильный список "Заявки" (по образцу MobileRegistry.tsx у "Обращений") — карточки
 * вместо десктопной Table, фильтр упрощён до чипов (те же три view, что и на десктопе,
 * см. LeadsPage.tsx). Дейт-пикер и плитки статистики — то же, что на десктопе
 * (LeadsPage.tsx), но без bar-графика по дням (см. STAT_CARDS выше). */
export function MobileLeadsRegistry({
  view,
  onViewChange,
  leads,
  isLoading,
  isError,
  from,
  to,
  onFromChange,
  onToChange,
  stats,
  resetRange,
}: {
  view: LeadsView;
  onViewChange: (v: LeadsView) => void;
  leads: LeadDTO[];
  isLoading: boolean;
  isError: boolean;
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  stats: LeadConversionStats | undefined;
  resetRange: { from: string; to: string };
}) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-head font-bold text-text-1">Заявки</h1>
        <MobileDateRangePicker
          from={from}
          to={to}
          onChange={(f, t) => {
            onFromChange(f);
            onToChange(t);
          }}
          resetRange={resetRange}
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {STAT_CARDS.map((stat) => (
          <div key={stat.key} className="rounded-lg border border-rule bg-surface p-3.5">
            <div className="font-mono text-[22px] font-semibold tabular-nums" style={{ color: stat.color }}>
              {stats ? (stats[stat.key] ?? "—") : "—"}
            </div>
            <div className="mt-0.5 text-meta leading-tight text-text-3">{stat.label}</div>
          </div>
        ))}
        <div className="rounded-lg border border-rule bg-surface p-3.5">
          <div className="font-mono text-[22px] font-semibold tabular-nums text-status-progress">
            {stats?.conversionRate !== null && stats?.conversionRate !== undefined ? `${stats.conversionRate.toFixed(0)}%` : "—"}
          </div>
          <div className="mt-0.5 text-meta leading-tight text-text-3">Конверсия</div>
        </div>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {CHIPS.map((c) => (
          <button
            key={c.value}
            onClick={() => onViewChange(c.value)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-meta font-medium active:opacity-70",
              view === c.value ? "bg-action text-action-fg" : "bg-surface-sunk text-text-2",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        {isError && <p className="py-8 text-center text-ui text-status-overdue">Не удалось загрузить заявки.</p>}
        {!isError && isLoading && <p className="py-8 text-center text-ui text-text-3">Загрузка...</p>}
        {!isError && !isLoading && !leads.length && (
          <p className="py-8 text-center text-ui text-text-3">Заявок не найдено.</p>
        )}
        {!isError && leads.map((lead) => {
          const overdue = isOverdue(lead);
          return (
            <button
              key={lead.id}
              onClick={() => navigate(`/leads/${lead.id}`)}
              className="relative rounded-lg border border-rule bg-surface p-3.5 text-left active:bg-surface-sunk"
            >
              {lead.aiIsRelevant !== null && (
                <span className="absolute right-3.5 top-3.5">
                  {lead.aiIsRelevant ? (
                    <CheckCircle2 className="size-4 text-status-closed" aria-label="ИИ считает релевантным" />
                  ) : (
                    <AlertTriangle className="size-4 text-status-review" aria-label="ИИ считает нерелевантным" />
                  )}
                </span>
              )}
              <span className="block pr-6 text-ui font-medium leading-snug text-text-1">
                {lead.fromName ?? lead.fromEmail}
              </span>
              {/* line-clamp-1 — та же логика, что и у MobileRegistry.tsx (обращения):
                  одна высота карточки независимо от длины темы письма. БЕЗ block рядом
                  — конфликтует с display, который сам объявляет line-clamp (реальный
                  баг, из-за которого текст вообще не обрезался — см. MobileRegistry.tsx). */}
              <span className="mt-0.5 line-clamp-1 break-words text-meta leading-snug text-text-3">
                {lead.subject}
              </span>
              <span className="mt-1.5 block font-mono text-meta text-text-3">
                {lead.publicNumber} · {new Date(lead.createdAt).toLocaleDateString("ru-RU")}
              </span>
              <div className="mt-3 flex items-center gap-2">
                {overdue ? (
                  <span className="inline-block rounded-full bg-status-overdue px-2.5 py-1 text-label font-semibold text-white">
                    Просрочена
                  </span>
                ) : (
                  <span
                    className="inline-block rounded-full px-2.5 py-1 text-label font-semibold text-white"
                    style={{ background: STATUS_COLOR[lead.status] }}
                  >
                    {LEAD_STATUS_LABELS[lead.status]}
                  </span>
                )}
                {lead.bitrixAssignee && (
                  <span className="truncate text-meta text-text-3">{lead.bitrixAssignee.name}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
