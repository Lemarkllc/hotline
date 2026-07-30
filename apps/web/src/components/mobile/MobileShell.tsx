import { Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { MobileTabBar } from "./MobileTabBar";

const DETAIL_ROUTE = /^\/appeals\/[^/]+$/;

/** Мобильная оболочка (замена Sidebar+Topbar на брейкпоинте <768px, см. useIsMobile) —
 * design_handoff_mobile_pwa/. Карточка обращения (/appeals/:id) — полноэкранный оверлей
 * поверх таб-бара, а не ещё одна вкладка: таб-бар просто не рендерится на этом роуте,
 * сама страница красит фон на всю высоту сама (см. AppealDetailMobile). */
export function MobileShell() {
  const location = useLocation();
  const isDetailRoute = DETAIL_ROUTE.test(location.pathname);

  return (
    <div className="min-h-dvh bg-background pt-[env(safe-area-inset-top)]">
      <main className={cn(!isDetailRoute && "px-4 pb-[calc(72px+env(safe-area-inset-bottom))] pt-4")}>
        <Outlet />
      </main>
      {!isDetailRoute && <MobileTabBar />}
    </div>
  );
}
