import { Outlet } from "react-router-dom";
import type { Permission } from "@hotline/shared";
import { useAuthStore } from "@/lib/authStore";
import { NoAccess } from "@/components/layout/NoAccess";

/**
 * Аналог RequirePermission, но для случаев, где доступ даётся напрямую по роли
 * (например, HRD подтверждает заявки на доступ, не имея user.manage — см.
 * userService.requireHrdOrAdmin на бэкенде). anyOfRoles ИЛИ permission — тот же
 * "или", что и в бэкенд-проверке.
 */
export function RequireRole({ anyOfRoles, permission }: { anyOfRoles: string[]; permission?: Permission }) {
  const roleNames = useAuthStore((s) => s.user?.roleNames ?? []);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const allowed = roleNames.some((r) => anyOfRoles.includes(r)) || (permission ? hasPermission(permission) : false);
  if (!allowed) return <NoAccess />;
  return <Outlet />;
}
