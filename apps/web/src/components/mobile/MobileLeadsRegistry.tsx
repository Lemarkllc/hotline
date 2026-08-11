import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@hotline/shared";
import { cn } from "@/lib/utils";
import type { LeadDTO, LeadsView } from "@/hooks/api";

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

/** Мобильный список "Заявки" (по образцу MobileRegistry.tsx у "Обращений") — карточки
 * вместо десктопной Table, фильтр упрощён до чипов (те же три view, что и на десктопе,
 * см. LeadsPage.tsx). */
export function MobileLeadsRegistry({
  view,
  onViewChange,
  leads,
  isLoading,
}: {
  view: LeadsView;
  onViewChange: (v: LeadsView) => void;
  leads: LeadDTO[];
  isLoading: boolean;
}) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[20px] font-extrabold text-foreground">Заявки</h1>

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
        {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Загрузка...</p>}
        {!isLoading && !leads.length && (
          <p className="py-8 text-center text-sm text-muted-foreground">Заявок не найдено.</p>
        )}
        {leads.map((lead) => (
          <button
            key={lead.id}
            onClick={() => navigate(`/leads/${lead.id}`)}
            className="relative rounded-[14px] border border-border bg-surface p-3.5 text-left"
          >
            {lead.aiIsRelevant !== null && (
              <span className="absolute right-3.5 top-3.5">
                {lead.aiIsRelevant ? (
                  <CheckCircle2 className="size-4 text-emerald-500" aria-label="ИИ считает релевантным" />
                ) : (
                  <AlertTriangle className="size-4 text-amber-500" aria-label="ИИ считает нерелевантным" />
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
