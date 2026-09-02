import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/** Визуальная часть usePullToRefresh — сам жест общий, разметка вынесена отдельно,
 * т.к. используется и в MobileShell (window-скролл вкладок), и в AppealDetailMobile
 * (свой overflow-контейнер карточки). */
export function PullToRefreshIndicator({
  pullDistance,
  refreshing,
  threshold,
}: {
  pullDistance: number;
  refreshing: boolean;
  threshold: number;
}) {
  const height = refreshing ? 44 : pullDistance;
  const ready = pullDistance >= threshold;

  return (
    // grid-template-rows вместо height — во время живого перетаскивания transition
    // не задан (JS обновляет каждый кадр по позиции пальца), а "снэп" к 44px при
    // refreshing анимируется через ряд грида, не layout-свойство height напрямую
    // (детектор impeccable: layout-transition).
    <div
      className="grid shrink-0 overflow-hidden"
      style={{
        gridTemplateRows: `${height}px`,
        transition: refreshing ? "grid-template-rows 150ms ease" : undefined,
      }}
    >
      <div className="flex min-h-0 items-center justify-center">
        <RefreshCw
          className={cn("size-5", ready || refreshing ? "text-text-1" : "text-text-3", refreshing && "animate-spin")}
          style={!refreshing ? { transform: `rotate(${Math.min(pullDistance, threshold) * 2.5}deg)` } : undefined}
        />
      </div>
    </div>
  );
}
