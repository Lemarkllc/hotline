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
      <h1 className="text-head font-bold text-text-1">Обращения</h1>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-3" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Поиск по номеру или тексту"
          // text-[16px], не 14px: iOS Safari сам зумит страницу при фокусе на любом
          // поле с font-size < 16px и не всегда отменяет зум после потери фокуса —
          // клавиатура закрывается, а страница остаётся увеличенной.
          className="h-touch w-full rounded-lg border border-rule-strong bg-surface pl-10 pr-3 text-[16px] text-text-1 placeholder:text-text-3 focus:outline-none active:bg-surface-sunk"
        />
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {CHIPS.map((c) => (
          <button
            key={c.value}
            onClick={() => onChipChange(c.value)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-meta font-medium active:opacity-70",
              chip === c.value ? "bg-action text-action-fg" : "bg-surface-sunk text-text-2",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        {isLoading && <p className="py-8 text-center text-ui text-text-3">Загрузка...</p>}
        {!isLoading && !appeals.length && (
          <p className="py-8 text-center text-ui text-text-3">Обращений не найдено.</p>
        )}
        {appeals.map((a) => {
          const title = (a.workingEdit ?? a.originalText).trim();
          return (
            <button
              key={a.id}
              onClick={() => navigate(`/appeals/${a.id}`)}
              className="relative rounded-lg border border-rule bg-surface p-3.5 text-left active:bg-surface-sunk"
            >
              {a.mode === "CONFIDENTIAL" && (
                <Lock className="absolute right-3.5 top-3.5 size-4 text-confidential" />
              )}
              <div className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-sunk font-mono text-ui font-medium text-text-2">
                  {(APPEAL_TYPE_LABELS[a.type] ?? a.type)[0]}
                </span>
                <span className="min-w-0 flex-1 pr-5">
                  {/* line-clamp-1, не 2 — карточки должны быть одной высоты независимо
                      от длины текста обращения, полный текст — уже на карточке
                      обращения после открытия. БЕЗ класса block рядом — оба задают
                      display, и в скомпилированном CSS .block шёл ПОСЛЕ .line-clamp-1,
                      поэтому побеждал и полностью отключал обрезание (реальный баг,
                      пойманный вживую — line-clamp сам объявляет свой display, ставить
                      его нельзя). */}
                  <span className="line-clamp-1 break-words text-ui font-medium leading-snug text-text-1">
                    {title || "Без текста"}
                  </span>
                  <span className="mt-1 block font-mono text-meta text-text-3">
                    {a.publicNumber} · {APPEAL_TYPE_LABELS[a.type] ?? a.type} ·{" "}
                    {new Date(a.createdAt).toLocaleDateString("ru-RU")}
                  </span>
                </span>
              </div>
              <span
                className="mt-3 inline-block rounded-full px-2.5 py-1 text-label font-semibold text-white"
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
