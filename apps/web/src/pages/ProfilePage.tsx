import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useAuthStore } from "@/lib/authStore";
import { setupWebPush } from "@/lib/webPush";

const ROLE_LABELS: Record<string, string> = {
  EMPLOYEE: "Сотрудник",
  MANAGER: "Менеджер",
  ADMINISTRATOR: "Администратор",
  HRD: "HRD",
  SALES: "Продажи",
};

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Мобильный экран "Профиль" (design_handoff_mobile_pwa) — у десктопной панели нет
 * прямого аналога, вход в свой аккаунт там через Topbar (имя+выход). Здесь отдельная
 * вкладка, т.к. в bottom tab bar нужно 4 постоянных пункта навигации. */
export function ProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);

  if (!user) return null;

  const roleLabel = user.roleNames.map((r) => ROLE_LABELS[r] ?? r).join(", ");

  async function handlePush() {
    setPushStatus("Запрашиваем разрешение...");
    await setupWebPush();
    setPushStatus(
      typeof Notification !== "undefined" && Notification.permission === "granted"
        ? "Push-уведомления включены на этом устройстве."
        : "Разрешение не выдано — включите его в настройках браузера.",
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 pb-6">
      <div className="flex flex-col items-center gap-3 pt-4">
        <div className="flex size-[72px] items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
          {initials(user.fullName)}
        </div>
        <div className="text-center">
          <p className="text-[17px] font-bold text-foreground">{user.fullName}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {roleLabel}
            {user.email ? ` · ${user.email}` : ""}
          </p>
        </div>
      </div>

      <div className="w-full divide-y divide-border overflow-hidden rounded-[16px] border border-border bg-surface">
        <button
          onClick={() => navigate("/change-password")}
          className="flex w-full items-center justify-between px-4 py-4 text-left text-[15px] text-foreground"
        >
          Сменить пароль
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>
        <div className="px-4 py-4 text-[15px] text-foreground">
          <p>Двухфакторная аутентификация</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Настраивается при первом входе для вашей роли, если требуется.
          </p>
        </div>
        <button
          onClick={() => void handlePush()}
          className="flex w-full flex-col items-start px-4 py-4 text-left text-[15px] text-foreground"
        >
          <span className="flex w-full items-center justify-between">
            Push-уведомления
            <ChevronRight className="size-4 text-muted-foreground" />
          </span>
          {pushStatus && <span className="mt-1 text-[12px] text-muted-foreground">{pushStatus}</span>}
        </button>
        <button
          onClick={() => setAboutOpen((v) => !v)}
          className="flex w-full flex-col items-start px-4 py-4 text-left text-[15px] text-foreground"
        >
          <span className="flex w-full items-center justify-between">
            О приложении
            <ChevronRight className="size-4 text-muted-foreground" />
          </span>
          {aboutOpen && (
            <span className="mt-1 text-[12px] text-muted-foreground">
              HotLine — внутренняя система обращений сотрудников и клиентов.
            </span>
          )}
        </button>
      </div>

      <button
        onClick={logout}
        className="w-full rounded-[16px] border border-border bg-surface py-4 text-center text-[15px] font-semibold text-destructive"
      >
        Выйти
      </button>
    </div>
  );
}
