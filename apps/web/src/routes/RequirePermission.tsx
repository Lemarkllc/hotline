import { Outlet } from "react-router-dom";
import type { Channel, Permission } from "@hotline/shared";
import { useAuthStore } from "@/lib/authStore";
import { NoAccess } from "@/components/layout/NoAccess";

/**
 * Гейтинг на уровне роута — Sidebar уже прячет пункты меню без нужного permission,
 * но прямой переход по URL (например, закладка) не должен показывать пустую страницу,
 * маскирующуюся под "данных нет": бэкенд всё равно вернёт 403, здесь — явное сообщение.
 */
export function RequirePermission({ permission, channel }: { permission: Permission; channel?: Channel }) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  if (!hasPermission(permission, channel)) return <NoAccess />;
  return <Outlet />;
}
