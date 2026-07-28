import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { setupWebPush } from "@/lib/webPush";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell() {
  useEffect(() => {
    void setupWebPush();
  }, []);

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
