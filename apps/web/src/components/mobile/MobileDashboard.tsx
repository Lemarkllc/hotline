import { useNavigate } from "react-router-dom";
import { APPEAL_STATUS_LABELS, type AppealStatus } from "@hotline/shared";
import { APPEAL_TYPE_LABELS, statusColor } from "@/components/appeals/badges";
import type { AppealDTO, ReportSummary } from "@/hooks/api";

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "Доброй ночи";
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}

// Только первая буква всей строки — CSS text-transform:capitalize (класс `capitalize`)
// капитализирует КАЖДОЕ слово ("30 Июля" вместо "30 июля"), что для русских дат неверно.
function capitalizeFirst(text: string): string {
  return text ? text[0]!.toUpperCase() + text.slice(1) : text;
}

const STAT_CARDS: { key: keyof ReportSummary["byStatus"] | "lowRating"; label: string; color: string }[] = [
  { key: "OPEN", label: "Открыто", color: statusColor("OPEN") },
  { key: "IN_PROGRESS", label: "В работе", color: statusColor("IN_PROGRESS") },
  { key: "CLOSED", label: "Закрыто", color: statusColor("CLOSED") },
  { key: "lowRating", label: "Низкие оценки", color: "#C20F1A" },
];

/**
 * Мобильный дашборд (design_handoff_mobile_pwa) — те же данные, что и десктопный
 * (useReportSummary), другая подача: 2×2 сетка вместо 7 KPI-карточек + графиков
 * (recharts на телефоне не нужен — с той же информацией куда быстрее работать списком).
 * "Просрочено" из прототипа сюда не попало — в бэкенде нет понятия SLA/дедлайна
 * обращения (ни в SRS, ни в reportService), выдумывать его тут не стал; вместо
 * этого "Низкие оценки" — такая же значимая для реагирования метрика, уже есть в API.
 */
export function MobileDashboard({
  userName,
  data,
  recentAppeals,
}: {
  userName: string;
  data: ReportSummary;
  recentAppeals: AppealDTO[];
}) {
  const navigate = useNavigate();
  const dateLabel = new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-head font-bold text-text-1">
            {greeting()}, {userName.split(" ")[0]}
          </h1>
          <p className="mt-0.5 text-meta text-text-3">{capitalizeFirst(dateLabel)}</p>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-action font-mono text-ui font-medium text-action-fg">
          {initials(userName)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {STAT_CARDS.map((stat) => {
          const value =
            stat.key === "lowRating"
              ? data.lowRatingShare !== null
                ? `${data.lowRatingShare.toFixed(0)}%`
                : "—"
              : (data.byStatus[stat.key as AppealStatus] ?? 0);
          return (
            <div key={stat.label} className="rounded-lg border border-rule bg-surface p-4">
              <div className="font-mono text-[26px] font-semibold tabular-nums" style={{ color: stat.color }}>
                {value}
              </div>
              <div className="mt-0.5 text-meta text-text-3">{stat.label}</div>
            </div>
          );
        })}
      </div>

      <div>
        <p className="mb-3 text-ui font-semibold text-text-1">Последние обращения</p>
        <div className="flex flex-col gap-2.5">
          {!recentAppeals.length && <p className="text-ui text-text-3">Обращений пока нет.</p>}
          {recentAppeals.map((a) => (
            <button
              key={a.id}
              onClick={() => navigate(`/appeals/${a.id}`)}
              className="flex items-center gap-3 rounded-lg border border-rule bg-surface p-3.5 text-left active:bg-surface-sunk"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-sunk font-mono text-ui font-medium text-text-2">
                {(APPEAL_TYPE_LABELS[a.type] ?? a.type)[0]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ui font-medium text-text-1">
                  {APPEAL_TYPE_LABELS[a.type] ?? a.type}
                </span>
                <span className="mt-0.5 block font-mono text-meta text-text-3">
                  {a.publicNumber} · {new Date(a.createdAt).toLocaleDateString("ru-RU")}
                </span>
              </span>
              <span
                className="shrink-0 rounded-full px-2.5 py-1 text-label font-semibold text-white"
                style={{ background: statusColor(a.status) }}
              >
                {APPEAL_STATUS_LABELS[a.status]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
