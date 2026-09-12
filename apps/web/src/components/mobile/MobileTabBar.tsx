import { NavLink } from "react-router-dom";
import { AlertTriangle, Bell, CalendarDays, LayoutDashboard, Mail, ScrollText, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/api";
import { useAuthStore } from "@/lib/authStore";

const FIRST_TAB = { to: "/dashboard", label: "Главная", icon: LayoutDashboard };
const LAST_TABS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/notifications", label: "Уведомл.", icon: Bell },
  { to: "/profile", label: "Профиль", icon: User },
];

/** Нижняя таб-бар навигация (design_handoff_mobile_pwa) — вкладки вместо Sidebar.
 * Карточка обращения открывается поверх неё отдельным полноэкранным роутом
 * (/appeals/:id), таб-бар просто не рендерится на этом экране, см. MobileShell.
 *
 * Средние вкладки — динамический список по правам, не жёсткая пара "одна вторая
 * вкладка на выбор": раньше HRD/HR (appeal.read_* + vacation.manage/hr.process, но
 * без lead.manage) получали только "Реестр" — раздел "Отсутствие" был физически
 * недостижим с телефона, хотя данные там были (реальный инцидент — HRD не находила
 * заявку сотрудника, хотя та существовала). Теперь показываем ВСЕ разделы, на
 * которые есть права, а не выбираем один "победивший" — Реестр остаётся важнее
 * для HRD, чем для "Продаж" (у которых лидов кратно больше и появился отдельный
 * пункт "Заявки"), поэтому оба могут сосуществовать одновременно.
 *
 * НЕ appeal.read_* канало-скоуплен (hasPermission проверяет activeChannel), а у
 * "Продаж" бывает по ошибке выдан EMPLOYEE-грант вместо CUSTOMER (реальный баг —
 * см. чат), из-за чего appeal.read_all мог бы ложно резолвиться в true и подсовывать
 * им чужую, HRD-шную очередь обращений. appeal.read_assigned — тот же риск слабее
 * (Менеджер и так работает в EMPLOYEE), но для консистентности решает точно так
 * же: любое из трёх appeal.read_* прав включает "Реестр" независимо от канала —
 * контроль доступа к самим данным всё равно на бэкенде (appealService), здесь
 * только видимость пункта меню.
 */
export function MobileTabBar() {
  const { data: notifications } = useNotifications();
  const hasUnread = (notifications?.filter((n) => n.status === "PENDING").length ?? 0) > 0;
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const middleTabs: { to: string; label: string; icon: LucideIcon }[] = [];
  if (hasPermission("appeal.read_all") || hasPermission("appeal.read_assigned") || hasPermission("appeal.read_author")) {
    middleTabs.push({ to: "/appeals", label: "Реестр", icon: ScrollText });
  }
  if (hasPermission("lead.manage")) {
    middleTabs.push({ to: "/leads", label: "Заявки", icon: Mail });
    // «SLA Лиды» (зависшие лиды Bitrix24, grill-me допрос 2026-09-12) — тот же
    // lead.manage, что и «Заявки»: РОП работает преимущественно с телефона, недостижимо
    // с мобилы означало бы фактически нерабочую фичу (тот же урок, что и с «Отсутствие»
    // выше — см. комментарий блока).
    middleTabs.push({ to: "/sla-leads", label: "SLA Лиды", icon: AlertTriangle });
  }
  if (hasPermission("vacation.manage") || hasPermission("hr.process")) {
    middleTabs.push({ to: "/vacations", label: "Отсутствие", icon: CalendarDays });
  }
  const tabs = [FIRST_TAB, ...middleTabs, ...LAST_TABS];

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
