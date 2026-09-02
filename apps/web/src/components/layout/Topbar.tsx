import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { useAuthStore } from "@/lib/authStore";
import { useMarkNotificationRead, useNotifications } from "@/hooks/api";
import { describeNotification } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { data: notifications } = useNotifications();
  const markRead = useMarkNotificationRead();
  const [open, setOpen] = useState(false);

  const unreadCount = notifications?.filter((n) => n.status === "PENDING").length ?? 0;

  return (
    <header className="flex h-14 items-center justify-between border-b border-rule bg-surface px-6">
      <div />
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <div className="relative">
          <Button variant="ghost" size="icon" aria-label="Уведомления" onClick={() => setOpen((v) => !v)}>
            <Bell className="size-5" />
          </Button>
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-status-overdue" />
          )}
          {open && (
            <div className="absolute right-0 z-30 mt-2 w-80 rounded-md border border-rule bg-surface shadow-3">
              <div className="max-h-96 overflow-y-auto p-2">
                {!notifications?.length && <p className="p-3 text-meta text-text-3">Уведомлений нет.</p>}
                {notifications?.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      markRead.mutate(n.id);
                      setOpen(false);
                      if (n.appealId) navigate(`/appeals/${n.appealId}`);
                      else if (n.emailLeadId) navigate(`/leads/${n.emailLeadId}`);
                    }}
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 rounded-md p-3 text-left text-ui hover:bg-surface-sunk",
                      n.status === "PENDING" ? "font-medium text-text-1" : "text-text-3",
                    )}
                  >
                    <span>{describeNotification(n.payload)}</span>
                    <span className="text-meta text-text-3">{new Date(n.createdAt).toLocaleString("ru-RU")}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
