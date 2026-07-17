import { NavLink } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  Flame,
  LayoutDashboard,
  ScrollText,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/authStore";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "report.read" as const },
  { to: "/appeals", label: "Обращения", icon: ScrollText, permission: "appeal.read_assigned" as const },
  { to: "/reports", label: "Отчёты", icon: BarChart3, permission: "report.read" as const },
  { to: "/users", label: "Пользователи", icon: Users, permission: "user.manage" as const },
  { to: "/directories", label: "Справочники", icon: BookOpen, permission: "user.manage" as const },
  { to: "/audit", label: "Аудит", icon: Settings, permission: "audit.read" as const },
];

export function Sidebar() {
  const hasPermission = useAuthStore((s) => s.hasPermission);

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex h-16 items-center gap-2 px-6 text-lg font-semibold">
        <Flame className="size-5 text-amber-500" />
        HotLine
      </div>
      <nav className="flex flex-col gap-1 px-3">
        {NAV_ITEMS.filter((item) => hasPermission(item.permission)).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-background hover:text-foreground",
              )
            }
          >
            <item.icon className="size-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
