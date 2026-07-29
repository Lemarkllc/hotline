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
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/authStore";
import { useAccessRequests } from "@/hooks/api";

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

function SidebarLink({ to, icon: Icon, label, badge }: { to: string; icon: LucideIcon; label: string; badge?: number }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-background hover:text-foreground",
        )
      }
    >
      <Icon className="size-4" />
      <span className="flex-1">{label}</span>
      {Boolean(badge) && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold tabular-nums text-destructive-foreground">
          {badge}
        </span>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const roleNames = useAuthStore((s) => s.user?.roleNames ?? []);
  const canManageUsers = hasPermission("user.manage");
  // Отдельный пункт для HRD без user.manage — у Administrator те же заявки уже
  // доступны на "Пользователи", дублировать пункт меню незачем.
  const showAccessRequests = roleNames.includes("HRD") && !canManageUsers;
  // Живой счётчик новых заявок на регистрацию из бота — общий источник для обоих
  // пунктов меню ("Пользователи" у Admin, "Заявки на доступ" у HRD), поэтому один
  // запрос вместо двух; опрашивается только если пункт вообще виден пользователю.
  const { data: accessRequests } = useAccessRequests(canManageUsers || showAccessRequests);
  const pendingCount = accessRequests?.length ?? 0;

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex h-16 items-center gap-2 px-6 text-lg font-semibold">
        <Flame className="size-5 text-amber-500" />
        HotLine
      </div>
      <nav className="flex flex-col gap-1 px-3">
        {showAccessRequests && (
          <SidebarLink to="/access-requests" icon={UserCheck} label="Заявки на доступ" badge={pendingCount} />
        )}
        {NAV_ITEMS.filter((item) => item.permissions.some((p) => hasPermission(p))).map((item) => (
          <SidebarLink
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            badge={item.to === "/users" ? pendingCount : undefined}
          />
        ))}
      </nav>
    </aside>
  );
}
