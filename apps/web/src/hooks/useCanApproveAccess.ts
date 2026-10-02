import { useAuthStore } from "@/lib/authStore";

/** Кто одобряет заявки на доступ: HRD (без user.manage) или Администратор (user.manage) —
 * то же «или», что и маршрут /access-requests (RequireRole) и userService.requireHrdOrAdmin. */
export function useCanApproveAccess(): boolean {
  const roleNames = useAuthStore((s) => s.user?.roleNames ?? []);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  return roleNames.includes("HRD") || hasPermission("user.manage");
}
