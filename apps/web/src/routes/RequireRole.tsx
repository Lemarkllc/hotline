import { Outlet } from "react-router-dom";
import type { Permission } from "@hotline/shared";
import { ShieldAlert } from "lucide-react";
import { useAuthStore } from "@/lib/authStore";

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
  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <ShieldAlert className="size-10 text-muted-foreground" />
        <p className="text-lg font-medium">Доступ запрещён</p>
        <p className="text-sm text-muted-foreground">
          Для этого раздела нужны права, которых нет у вашей роли.
        </p>
      </div>
    );
  }
  return <Outlet />;
}
