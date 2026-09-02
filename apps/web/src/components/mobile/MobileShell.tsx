import { Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { MobileTabBar } from "./MobileTabBar";
import { PullToRefreshIndicator } from "./PullToRefreshIndicator";

const DETAIL_ROUTE = /^\/(appeals|leads)\/[^/]+$/;

/** Мобильная оболочка (замена Sidebar+Topbar на брейкпоинте <768px, см. useIsMobile) —
 * design_handoff_mobile_pwa/. Карточка обращения (/appeals/:id) и карточка лида
 * (/leads/:id) — полноэкранный оверлей поверх таб-бара, а не ещё одна вкладка: таб-бар
 * просто не рендерится на этом роуте, сама страница красит фон на всю высоту сама
 * (см. AppealDetailMobile/MobileLeadDetail). Без этого исключения фиксированный
 * таб-бар (z-30) рисовался бы поверх композера оверлея — реальный баг, пойманный
 * прогоном impeccable: композер ответа лиду перекрывался таб-баром снизу. */
export function MobileShell() {
  const location = useLocation();
  const isDetailRoute = DETAIL_ROUTE.test(location.pathname);
  // Без containerRef — вкладки таб-бара скроллятся на уровне document/window
  // (у MobileShell нет своего overflow-контейнера), см. usePullToRefresh.
  const { pullDistance, refreshing, threshold } = usePullToRefresh();

  return (
    <div className="min-h-dvh bg-ground pt-[env(safe-area-inset-top)]">
      {!isDetailRoute && (
        <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} threshold={threshold} />
      )}
      <main className={cn(!isDetailRoute && "px-4 pb-[calc(72px+env(safe-area-inset-bottom))] pt-4")}>
        <Outlet />
      </main>
      {!isDetailRoute && <MobileTabBar />}
    </div>
  );
}
