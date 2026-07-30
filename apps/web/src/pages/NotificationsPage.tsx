import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useMarkNotificationRead, useNotifications } from "@/hooks/api";
import { describeNotification } from "@/lib/notifications";

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "вчера";
  return `${days} дн назад`;
}

/** Мобильный экран "Уведомления" (design_handoff_mobile_pwa) — тот же поллинг и тот
 * же payload, что и десктопный колокольчик (Topbar), просто отдельная вкладка вместо
 * дропдауна: на телефоне нет места под fixed-позиционированную плашку в углу. */
export function NotificationsPage() {
  const navigate = useNavigate();
  const { data: notifications } = useNotifications();
  const markRead = useMarkNotificationRead();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[20px] font-extrabold text-foreground">Уведомления</h1>
      <div className="flex flex-col gap-3">
        {!notifications?.length && (
          <p className="py-8 text-center text-sm text-muted-foreground">Уведомлений нет.</p>
        )}
        {notifications?.map((n) => {
          const unread = n.status === "PENDING";
          return (
            <button
              key={n.id}
              onClick={() => {
                if (unread) markRead.mutate(n.id);
                if (n.appealId) navigate(`/appeals/${n.appealId}`);
              }}
              className="flex items-start gap-3 rounded-[14px] border border-border bg-surface p-4 text-left"
            >
              <span
                className={cn("mt-1.5 size-2 shrink-0 rounded-full", unread ? "bg-primary" : "bg-border")}
              />
              <span className="flex-1">
                <span className={cn("block text-[13px] leading-snug text-foreground", unread ? "font-semibold" : "font-normal")}>
                  {describeNotification(n.payload)}
                </span>
                <span className="mt-1 block text-[12px] text-muted-foreground">{relativeTime(n.createdAt)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
