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

const STATUS_COLOR: Record<LeadStatus, string> = {
  NEW: "#2563eb",
  IN_PROGRESS: "#d97706",
  CONVERTED: "#16a34a",
  STOP_LISTED: "#dc2626",
};

/** Плитки статистики за выбранный период — тот же 2×2 паттерн, что и у
 * MobileDashboard.tsx (крупная цифра + подпись), без графика по дням: recharts на
 * телефоне не нужен, тот же принцип, что и у MobileDashboard (см. его комментарий). */
const STAT_CARDS: { key: keyof LeadConversionStats; label: string; color: string; suffix?: string }[] = [
  { key: "total", label: "Всего заявок", color: "#475569" },
  { key: "converted", label: "Передано в CRM", color: "#16a34a" },
  { key: "aiRelevant", label: "Качественных (ИИ)", color: "#d97706" },
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
        <h1 className="text-[20px] font-extrabold text-foreground">Заявки</h1>
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
          <div key={stat.key} className="rounded-[15px] border border-border bg-surface p-3.5">
            <div className="text-[22px] font-extrabold" style={{ color: stat.color }}>
              {stats ? (stats[stat.key] ?? "—") : "—"}
            </div>
            <div className="mt-0.5 text-[12px] leading-tight text-muted-foreground">{stat.label}</div>
          </div>
        ))}
        <div className="rounded-[15px] border border-border bg-surface p-3.5">
          <div className="text-[22px] font-extrabold text-[#2563eb]">
            {stats?.conversionRate !== null && stats?.conversionRate !== undefined ? `${stats.conversionRate.toFixed(0)}%` : "—"}
          </div>
          <div className="mt-0.5 text-[12px] leading-tight text-muted-foreground">Конверсия</div>
        </div>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {CHIPS.map((c) => (
          <button
            key={c.value}
            onClick={() => onViewChange(c.value)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-[13px] font-medium",
              view === c.value ? "bg-primary text-primary-foreground" : "bg-background text-[#475569]",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        {isError && <p className="py-8 text-center text-sm text-destructive">Не удалось загрузить заявки.</p>}
        {!isError && isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Загрузка...</p>}
        {!isError && !isLoading && !leads.length && (
          <p className="py-8 text-center text-sm text-muted-foreground">Заявок не найдено.</p>
        )}
        {!isError && leads.map((lead) => (
          <button
            key={lead.id}
            onClick={() => navigate(`/leads/${lead.id}`)}
            className="relative rounded-[14px] border border-border bg-surface p-3.5 text-left"
          >
            {lead.aiIsRelevant !== null && (
              <span className="absolute right-3.5 top-3.5">
                {lead.aiIsRelevant ? (
                  <CheckCircle2 className="size-4 text-success" aria-label="ИИ считает релевантным" />
                ) : (
                  <AlertTriangle className="size-4 text-warning" aria-label="ИИ считает нерелевантным" />
                )}
              </span>
            )}
            <span className="block pr-6 text-[14px] font-semibold leading-snug text-foreground">
              {lead.fromName ?? lead.fromEmail}
            </span>
            {/* line-clamp-1 — та же логика, что и у MobileRegistry.tsx (обращения):
                одна высота карточки независимо от длины темы письма. БЕЗ block рядом
                — конфликтует с display, который сам объявляет line-clamp (реальный
                баг, из-за которого текст вообще не обрезался — см. MobileRegistry.tsx). */}
            <span className="mt-0.5 line-clamp-1 break-words text-[13px] leading-snug text-muted-foreground">
              {lead.subject}
            </span>
            <span className="mt-1.5 block text-[12px] text-muted-foreground">
              {lead.publicNumber} · {new Date(lead.createdAt).toLocaleDateString("ru-RU")}
            </span>
            <span
              className="mt-3 inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
              style={{ background: STATUS_COLOR[lead.status] }}
            >
              {LEAD_STATUS_LABELS[lead.status]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
