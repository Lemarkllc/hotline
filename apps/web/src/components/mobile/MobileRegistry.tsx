import { useNavigate } from "react-router-dom";
import { Lock, Search } from "lucide-react";
import { APPEAL_STATUS_LABELS, type AppealStatus } from "@hotline/shared";
import { cn } from "@/lib/utils";
import { APPEAL_TYPE_LABELS, statusColor } from "@/components/appeals/badges";
import type { AppealDTO } from "@/hooks/api";

const CHIPS: { label: string; value: string }[] = [
  { label: "Все", value: "all" },
  { label: "Открыто", value: "OPEN" },
  { label: "В работе", value: "IN_PROGRESS" },
  { label: "Закрыто", value: "CLOSED" },
];

/** Мобильный реестр (design_handoff_mobile_pwa) — карточки вместо таблицы (Table на
 * телефоне либо ужимается до нечитаемого, либо горизонтально скроллится — ни то, ни
 * другое не годится), фильтр упрощён до чипов "Все/Открыто/В работе/Закрыто" вместо
 * десктопного Select+доп.тумблеров (бэклог/низкие оценки) — на телефоне для них пока
 * нет места без ещё одного уровня навигации, которого прототип не предполагал. */
export function MobileRegistry({
  search,
  onSearchChange,
  chip,
  onChipChange,
  appeals,
  isLoading,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  chip: string;
  onChipChange: (v: string) => void;
  appeals: AppealDTO[];
  isLoading: boolean;
}) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[20px] font-extrabold text-foreground">Обращения</h1>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Поиск по номеру или тексту"
          // text-[16px], не 14px: iOS Safari сам зумит страницу при фокусе на любом
          // поле с font-size < 16px и не всегда отменяет зум после потери фокуса —
          // клавиатура закрывается, а страница остаётся увеличенной.
          className="h-[42px] w-full rounded-[12px] border border-border bg-surface pl-10 pr-3 text-[16px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {CHIPS.map((c) => (
          <button
            key={c.value}
            onClick={() => onChipChange(c.value)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-[13px] font-medium",
              chip === c.value ? "bg-primary text-primary-foreground" : "bg-background text-[#475569]",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Загрузка...</p>}
        {!isLoading && !appeals.length && (
          <p className="py-8 text-center text-sm text-muted-foreground">Обращений не найдено.</p>
        )}
        {appeals.map((a) => {
          const title = (a.workingEdit ?? a.originalText).trim();
          return (
            <button
              key={a.id}
              onClick={() => navigate(`/appeals/${a.id}`)}
              className="relative rounded-[14px] border border-border bg-surface p-3.5 text-left"
            >
              {a.mode === "CONFIDENTIAL" && (
                <Lock className="absolute right-3.5 top-3.5 size-4 text-confidential" />
              )}
              <div className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-background text-[14px] font-bold text-muted-foreground">
                  {(APPEAL_TYPE_LABELS[a.type] ?? a.type)[0]}
                </span>
                <span className="min-w-0 flex-1 pr-5">
                  <span className="line-clamp-2 block text-[14px] font-semibold leading-snug text-foreground">
                    {title || "Без текста"}
                  </span>
                  <span className="mt-1 block text-[12px] text-muted-foreground">
                    {a.publicNumber} · {APPEAL_TYPE_LABELS[a.type] ?? a.type} ·{" "}
                    {new Date(a.createdAt).toLocaleDateString("ru-RU")}
                  </span>
                </span>
              </div>
              <span
                className="mt-3 inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
                style={{ background: statusColor(a.status as AppealStatus) }}
              >
                {APPEAL_STATUS_LABELS[a.status]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
