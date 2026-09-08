import { Outlet } from "react-router-dom";
import type { Channel, Permission } from "@hotline/shared";
import { useAuthStore } from "@/lib/authStore";
import { NoAccess } from "@/components/layout/NoAccess";

/**
 * Гейтинг на уровне роута — Sidebar уже прячет пункты меню без нужного permission,
 * но прямой переход по URL (например, закладка) не должен показывать пустую страницу,
 * маскирующуюся под "данных нет": бэкенд всё равно вернёт 403, здесь — явное сообщение.
 */
/** anyOf — доступ по ЛЮБОМУ из перечисленных прав (например, /vacations нужен и
 * vacation.manage (HRD), и hr.process (роль HR) — раздельно они видят разные вкладки
 * внутри, но сам роут не должен 403'ить ни одной из них). permission — как раньше,
 * для единственного права. */
export function RequirePermission({
  permission,
  anyOf,
  channel,
}: {
  permission?: Permission;
  anyOf?: Permission[];
  channel?: Channel;
}) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const allowed = anyOf ? anyOf.some((p) => hasPermission(p, channel)) : permission ? hasPermission(permission, channel) : false;
  if (!allowed) return <NoAccess />;
  return <Outlet />;
}
