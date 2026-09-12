import { NavLink } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarDays,
  History,
  LayoutDashboard,
  LogOut,
  Mail,
  ScrollText,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@hotline/shared";
import { cn, initials } from "@/lib/utils";
import { useAuthStore } from "@/lib/authStore";
import {
  useAbsenceRequests,
  useAccessRequests,
  useBusinessTripRequests,
  useTerminationsAwaitingProcessing,
  useVacationRequests,
} from "@/hooks/api";
import { Button } from "@/components/ui/button";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  permissions: readonly Permission[];
}

/** Три группы вместо плоского списка (design_handoff_lemark_one/README.md "Навигация").
 * "Доступ и СКУД" из хендоффа сюда не включён — этого модуля ещё нет в коде (см.
 * UI_REWORK_BRIEF.md "Что осталось нарисовать"), пункт меню в никуда хуже отсутствующего
 * пункта. "Отсутствия" из того же списка реализован как раздел "Отпуска" (PLAN.md §10) —
 * одна страница с тремя вкладками (VacationRequest/AbsenceRequest/BusinessTripRequest),
 * без календаря пересечений по подразделению (отложен, см. план реализации). */
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Работа",
    items: [
      { to: "/dashboard", label: "Обзор", icon: LayoutDashboard, permissions: ["report.read"] },
      {
        to: "/appeals",
        label: "Обращения",
        icon: ScrollText,
        // "Обращения" видно по любому из трёх read-permission (в т.ч. Администратору с
        // appeal.read_all для ОБТ) — остальные пункты завязаны на одно право.
        permissions: ["appeal.read_assigned", "appeal.read_all", "appeal.read_author"],
      },
      // «Заявки» — email-лиды с sales@, независимая от «Обращения» подсистема
      // (PLAN.md "«Заявки» — email-лиды..."), поэтому отдельный permission, не appeal.*.
      { to: "/leads", label: "Заявки", icon: Mail, permissions: ["lead.manage"] },
      // Зависшие лиды Bitrix24 (grill-me допрос 2026-09-12) — отдельный источник данных
      // (crm.lead.list, не наш EmailLead), поэтому отдельный пункт, не вкладка "Заявок".
      { to: "/sla-leads", label: "SLA Лиды", icon: AlertTriangle, permissions: ["lead.manage"] },
      // Раздел (не только VacationRequest — внутри три вкладки, PLAN.md §10),
      // согласовывает только HRD — тот же принцип, что и у "Заявок". Название пункта
      // меню "Отсутствие" (решение пользователя) — сама вкладка "Отпуска" внутри
      // раздела называется иначе, путаницы с этим не считали проблемой.
      // hr.process — роль HR видит раздел ради вкладки «Оформление», без vacation.manage
      // (не может одобрять/отклонять — только чек-лист и «Оформить», см. VacationsPage.tsx).
      { to: "/vacations", label: "Отсутствие", icon: CalendarDays, permissions: ["vacation.manage", "hr.process"] },
    ],
  },
  {
    label: "Аналитика",
    items: [{ to: "/reports", label: "Отчёты", icon: BarChart3, permissions: ["report.read"] }],
  },
  {
    label: "Администрирование",
    items: [
      { to: "/users", label: "Пользователи", icon: Users, permissions: ["user.manage"] },
      { to: "/directories", label: "Справочники", icon: BookOpen, permissions: ["user.manage"] },
      { to: "/audit", label: "Аудит", icon: History, permissions: ["audit.read"] },
    ],
  },
];

function SidebarLink({ to, icon: Icon, label, badge }: { to: string; icon: LucideIcon; label: string; badge?: number }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex min-h-9 items-center gap-2.5 rounded-md px-2.5 text-ui font-medium transition-colors duration-1",
          isActive ? "bg-action text-action-fg" : "text-text-2 hover:bg-surface-sunk hover:text-text-1",
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="size-4 shrink-0" />
          <span className="flex-1 truncate">{label}</span>
          {Boolean(badge) && (
            <span
              className={cn(
                "flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-mono text-label font-medium tabular-nums",
                isActive ? "bg-action-fg text-action" : "bg-status-overdue-tint text-status-overdue",
              )}
            >
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const roleNames = useAuthStore((s) => s.user?.roleNames ?? []);
  const channels = useAuthStore((s) => s.user?.channels ?? []);
  const activeChannel = useAuthStore((s) => s.activeChannel);
  const setActiveChannel = useAuthStore((s) => s.setActiveChannel);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const canManageUsers = hasPermission("user.manage");
  // Отдельный пункт для HRD без user.manage — у Administrator те же заявки уже
  // доступны на "Пользователи", дублировать пункт меню незачем.
  const showAccessRequests = roleNames.includes("HRD") && !canManageUsers;
  const { data: accessRequests } = useAccessRequests(canManageUsers || showAccessRequests);
  const pendingCount = accessRequests?.length ?? 0;

  // Суммарный бейдж на пункте меню "Отсутствие" — PENDING по всем трём сущностям
  // раздела (PLAN.md §10), не только по вкладке "Отсутствия" одноимённой с пунктом
  // меню (совпадение названий, не одно и то же — см. комментарий у NAV_GROUPS).
  const canManageVacations = hasPermission("vacation.manage");
  const { data: pendingVacations } = useVacationRequests("PENDING", canManageVacations);
  const { data: pendingAbsences } = useAbsenceRequests("PENDING", canManageVacations);
  const { data: pendingBusinessTrips } = useBusinessTripRequests("PENDING", canManageVacations);
  // Тот же принцип для стадии «Оформление» (роль HR, право hr.process) — сумма
  // "ожидает оформления" по Отпуску и Увольнению, тем же образом добавляется к
  // общему бейджу пункта меню (HRD и HR никогда не видят чужую половину суммы,
  // т.к. соответствующие хуки включены только при наличии своего права).
  const canProcess = hasPermission("hr.process");
  const { data: awaitingVacations } = useVacationRequests("APPROVED", canProcess, false);
  const { data: awaitingTerminations } = useTerminationsAwaitingProcessing(canProcess);
  const vacationsPendingCount =
    (pendingVacations?.length ?? 0) +
    (pendingAbsences?.length ?? 0) +
    (pendingBusinessTrips?.length ?? 0) +
    (awaitingVacations?.length ?? 0) +
    (awaitingTerminations?.length ?? 0);

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-rule bg-surface">
      <div className="flex h-14 items-center gap-1.5 px-4 text-ui font-semibold text-text-1">
        Lemark<span className="text-brand">·</span>
        <span className="font-light text-text-2">One</span>
      </div>

      {/* Переключатель канала (Фаза 7, PLAN.md §6) — только для тех, у кого явно
       * выдан доступ к обоим каналам. */}
      {channels.length > 1 && (
        <div className="px-3 pb-2">
          <div className="inline-flex w-full rounded-md border border-rule-strong bg-surface p-1">
            <Button
              variant={activeChannel === "EMPLOYEE" ? "default" : "ghost"}
              size="sm"
              className="flex-1"
              onClick={() => setActiveChannel("EMPLOYEE")}
            >
              Сотрудники
            </Button>
            <Button
              variant={activeChannel === "CUSTOMER" ? "default" : "ghost"}
              size="sm"
              className="flex-1"
              onClick={() => setActiveChannel("CUSTOMER")}
            >
              Клиенты
            </Button>
          </div>
        </div>
      )}

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-2">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => item.permissions.some((p) => hasPermission(p)));
          const showGroup = items.length > 0 || (group.label === "Администрирование" && showAccessRequests);
          if (!showGroup) return null;
          return (
            <div key={group.label} className="flex flex-col gap-0.5">
              <p className="px-2.5 pb-1 font-mono text-label font-medium uppercase tracking-wide text-text-3">
                {group.label}
              </p>
              {items.map((item) => (
                <SidebarLink
                  key={item.to}
                  to={item.to}
                  icon={item.icon}
                  label={item.label}
                  badge={
                    item.to === "/users" ? pendingCount : item.to === "/vacations" ? vacationsPendingCount : undefined
                  }
                />
              ))}
              {group.label === "Администрирование" && showAccessRequests && (
                <SidebarLink to="/access-requests" icon={UserCheck} label="Заявки на доступ" badge={pendingCount} />
              )}
            </div>
          );
        })}
      </nav>

      <div className="flex items-center gap-2.5 border-t border-rule px-3 py-3">
        <div
          title={user?.fullName}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-sunk font-mono text-meta font-medium text-text-2"
        >
          {user ? initials(user.fullName) : "?"}
        </div>
        <button
          type="button"
          onClick={logout}
          aria-label="Выйти"
          className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-md text-text-3 hover:bg-surface-sunk hover:text-text-1"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </aside>
  );
}
