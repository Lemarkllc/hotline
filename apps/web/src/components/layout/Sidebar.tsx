import { NavLink } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  Flame,
  LayoutDashboard,
  ScrollText,
  Settings,
  UserCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/authStore";

// "Обращения" видно по любому из трёх read-permission (в т.ч. Администратору с
// appeal.read_all для ОБТ) — остальные пункты завязаны на одно право.
const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permissions: ["report.read"] as const },
  {
    to: "/appeals",
    label: "Обращения",
    icon: ScrollText,
    permissions: ["appeal.read_assigned", "appeal.read_all", "appeal.read_author"] as const,
  },
  { to: "/reports", label: "Отчёты", icon: BarChart3, permissions: ["report.read"] as const },
  { to: "/users", label: "Пользователи", icon: Users, permissions: ["user.manage"] as const },
  { to: "/directories", label: "Справочники", icon: BookOpen, permissions: ["user.manage"] as const },
  { to: "/audit", label: "Аудит", icon: Settings, permissions: ["audit.read"] as const },
];

export function Sidebar() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const roleNames = useAuthStore((s) => s.user?.roleNames ?? []);
  // Отдельный пункт для HRD без user.manage — у Administrator те же заявки уже
  // доступны на "Пользователи", дублировать пункт меню незачем.
  const showAccessRequests = roleNames.includes("HRD") && !hasPermission("user.manage");

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex h-16 items-center gap-2 px-6 text-lg font-semibold">
        <Flame className="size-5 text-amber-500" />
        HotLine
      </div>
      <nav className="flex flex-col gap-1 px-3">
        {showAccessRequests && (
          <NavLink
            to="/access-requests"
            className={({ isActive }) =>
              cn(
                "flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-background hover:text-foreground",
              )
            }
          >
            <UserCheck className="size-4" />
            Заявки на доступ
          </NavLink>
        )}
        {NAV_ITEMS.filter((item) => item.permissions.some((p) => hasPermission(p))).map((item) => (
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
