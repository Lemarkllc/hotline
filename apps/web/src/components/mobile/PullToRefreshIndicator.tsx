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
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden"
      style={{ height, transition: refreshing ? "height 150ms ease" : undefined }}
    >
      <RefreshCw
        className={cn("size-5", ready || refreshing ? "text-primary" : "text-muted-foreground", refreshing && "animate-spin")}
        style={!refreshing ? { transform: `rotate(${Math.min(pullDistance, threshold) * 2.5}deg)` } : undefined}
      />
    </div>
  );
}
