import { NavLink } from "react-router-dom";
import { Bell, LayoutDashboard, ScrollText, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/api";

const TABS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/dashboard", label: "Главная", icon: LayoutDashboard },
  { to: "/appeals", label: "Реестр", icon: ScrollText },
  { to: "/notifications", label: "Уведомл.", icon: Bell },
  { to: "/profile", label: "Профиль", icon: User },
];

/** Нижняя таб-бар навигация (design_handoff_mobile_pwa) — 4 вкладки вместо Sidebar.
 * Карточка обращения открывается поверх неё отдельным полноэкранным роутом
 * (/appeals/:id), таб-бар просто не рендерится на этом экране, см. MobileShell. */
export function MobileTabBar() {
  const { data: notifications } = useNotifications();
  const hasUnread = (notifications?.filter((n) => n.status === "PENDING").length ?? 0) > 0;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0px)" }}
    >
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 pt-2 text-[11px] font-medium",
              isActive ? "text-primary" : "text-muted-foreground",
            )
          }
        >
          <span className="relative">
            <Icon className="size-6" />
            {label === "Уведомл." && hasUnread && (
              <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-destructive" />
            )}
          </span>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
