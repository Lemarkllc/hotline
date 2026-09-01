import { NavLink } from "react-router-dom";
import { Bell, LayoutDashboard, Mail, ScrollText, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/api";
import { useAuthStore } from "@/lib/authStore";

const FIRST_TAB = { to: "/dashboard", label: "Главная", icon: LayoutDashboard };
const LAST_TABS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/notifications", label: "Уведомл.", icon: Bell },
  { to: "/profile", label: "Профиль", icon: User },
];

/** Нижняя таб-бар навигация (design_handoff_mobile_pwa) — 4 вкладки вместо Sidebar.
 * Карточка обращения открывается поверх неё отдельным полноэкранным роутом
 * (/appeals/:id), таб-бар просто не рендерится на этом экране, см. MobileShell.
 *
 * Вторая вкладка ролезависима, не константа: решает наличие lead.manage
 * (единолично у роли "Продажи", см. packages/shared/permissions.ts), НЕ
 * appeal.read_* — тот канало-скоуплен (hasPermission проверяет activeChannel),
 * а у "Продаж" бывает по ошибке выдан EMPLOYEE-грант вместо CUSTOMER (реальный
 * баг — см. чат), из-за чего appeal.read_all мог бы ложно резолвиться в true и
 * подсовывать им чужую, HRD-шную очередь обращений как "свою". lead.manage не
 * зависит от канала вообще, поэтому не подвержен этой гонке. У кого lead.manage
 * есть — их фактический рабочий инструмент — "Заявки", не "Реестр".
 */
export function MobileTabBar() {
  const { data: notifications } = useNotifications();
  const hasUnread = (notifications?.filter((n) => n.status === "PENDING").length ?? 0) > 0;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const secondTab = hasPermission("lead.manage")
    ? { to: "/leads", label: "Заявки", icon: Mail }
    : { to: "/appeals", label: "Реестр", icon: ScrollText };
  const tabs = [FIRST_TAB, secondTab, ...LAST_TABS];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-rule bg-surface"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 18px)" }}
    >
      {tabs.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "flex min-h-touch flex-1 flex-col items-center justify-center gap-1 pt-2 text-[11px] font-medium active:bg-surface-sunk",
              isActive ? "text-text-1" : "text-text-3",
            )
          }
        >
          <span className="relative">
            <Icon className="size-6" strokeWidth={1.5} />
            {label === "Уведомл." && hasUnread && (
              <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-status-overdue" />
            )}
          </span>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
