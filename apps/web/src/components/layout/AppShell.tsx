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
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
