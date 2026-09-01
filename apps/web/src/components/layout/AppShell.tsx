import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { setupWebPush } from "@/lib/webPush";
import { useIsMobile } from "@/hooks/useIsMobile";
import { MobileShell } from "@/components/mobile/MobileShell";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell() {
  const isMobile = useIsMobile();

  useEffect(() => {
    void setupWebPush();
  }, []);

  // Мобильная оболочка — принципиально другая структура навигации (bottom tab bar +
  // полноэкранные оверлеи вместо Sidebar/Topbar), не просто reflow тех же панелей —
  // см. design_handoff_mobile_pwa/README.md. Те же роуты/Outlet, тот же RequireAuth.
  if (isMobile) return <MobileShell />;

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      {/* min-w-0 — по умолчанию flex-элемент не сжимается меньше intrinsic-ширины
       * своего содержимого; без этого широкая таблица (например, min-w-[900px] на
       * LeadsPage, которая должна скроллиться ВНУТРИ себя) вместо этого раздвигала
       * всю колонку и страницу целиком за пределы вьюпорта. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
