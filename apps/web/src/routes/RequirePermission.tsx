import { Outlet } from "react-router-dom";
import type { Channel, Permission } from "@hotline/shared";
import { ShieldAlert } from "lucide-react";
import { useAuthStore } from "@/lib/authStore";

/**
 * Гейтинг на уровне роута — Sidebar уже прячет пункты меню без нужного permission,
 * но прямой переход по URL (например, закладка) не должен показывать пустую страницу,
 * маскирующуюся под "данных нет": бэкенд всё равно вернёт 403, здесь — явное сообщение.
 */
export function RequirePermission({ permission, channel }: { permission: Permission; channel?: Channel }) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  if (!hasPermission(permission, channel)) {
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
