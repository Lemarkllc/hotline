import { useState } from "react";
import { Bell, LogOut } from "lucide-react";
import { useAuthStore } from "@/lib/authStore";
import { useMarkNotificationRead, useNotifications } from "@/hooks/api";
import { Button } from "@/components/ui/button";

function describeNotification(payload: Record<string, unknown>): string {
  switch (payload.type) {
    case "new_appeal":
      return `Новое обращение ${payload.publicNumber}`;
    case "author_replied":
      return `Автор ответил по обращению ${payload.publicNumber}`;
    case "low_rating":
      return `Низкая оценка (${payload.score}) по обращению ${payload.publicNumber}`;
    case "assigned":
      return `Вам назначено обращение ${payload.publicNumber}`;
    case "internal_mention":
      return `${payload.fromFullName ?? "Коллега"} упомянул(а) вас в обращении ${payload.publicNumber}`;
    default:
      return "Новое уведомление";
  }
}

export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { data: notifications } = useNotifications();
  const markRead = useMarkNotificationRead();
  const [open, setOpen] = useState(false);

  const unreadCount = notifications?.filter((n) => n.status === "PENDING").length ?? 0;

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-6">
      <div />
      <div className="flex items-center gap-4">
        <div className="relative">
          <Button variant="ghost" size="icon" aria-label="Уведомления" onClick={() => setOpen((v) => !v)}>
            <Bell className="size-5" />
          </Button>
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
              {unreadCount}
            </span>
          )}
          {open && (
            <div className="absolute right-0 z-30 mt-2 w-80 rounded-md border border-border bg-surface shadow-lg">
              <div className="max-h-96 overflow-y-auto p-2">
                {!notifications?.length && (
                  <p className="p-3 text-sm text-muted-foreground">Уведомлений нет.</p>
                )}
                {notifications?.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => markRead.mutate(n.id)}
                    className={
                      "flex w-full flex-col items-start gap-0.5 rounded-md p-3 text-left text-sm hover:bg-background " +
                      (n.status === "PENDING" ? "font-medium" : "text-muted-foreground")
                    }
                  >
                    <span>{describeNotification(n.payload)}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(n.createdAt).toLocaleString("ru-RU")}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <span className="text-sm font-medium">{user?.fullName}</span>
        <Button variant="ghost" size="icon" aria-label="Выйти" onClick={logout}>
          <LogOut className="size-5" />
        </Button>
      </div>
    </header>
  );
}
