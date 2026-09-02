import { BarChart3 } from "lucide-react";

/** Пустое состояние графика — при нулевом периоде BarChart/PieChart/списки
 * рендерились полностью пустыми без единого сообщения (изначально найдено
 * прогоном impeccable на DashboardPage, тот же паттерн переиспользован на
 * ReportsPage — QA-аудит поймал те же пустые карточки там). */
export function EmptyChartState({ label }: { label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <BarChart3 className="size-7 text-text-3" strokeWidth={1.5} />
      <p className="text-meta text-text-3">{label}</p>
    </div>
  );
}
