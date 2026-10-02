import { useNavigate } from "react-router-dom";
import { ChevronRight, UserCheck } from "lucide-react";
import { useAccessRequests } from "@/hooks/api";
import { useCanApproveAccess } from "@/hooks/useCanApproveAccess";

/** Баннер «Заявки на доступ: N» в мобильной оболочке (MobileShell) — на любой вкладке,
 * пока есть необработанные заявки. В нижнем таб-баре места нет (до 7 вкладок), а без
 * этого одобрить нового сотрудника с телефона было невозможно (2026-10-02). */
export function AccessRequestsBanner() {
  const navigate = useNavigate();
  const canApprove = useCanApproveAccess();
  const { data: requests } = useAccessRequests(canApprove);
  const count = requests?.length ?? 0;
  if (!canApprove || count === 0) return null;

  return (
    <button
      onClick={() => navigate("/access-requests")}
      className="mb-4 flex w-full items-center gap-3 rounded-[14px] border border-action/30 bg-action/10 p-4 text-left active:bg-action/15"
    >
      <UserCheck className="size-5 shrink-0 text-action" strokeWidth={1.75} />
      <span className="flex-1">
        <span className="block text-[15px] font-semibold text-text-1">Заявки на доступ: {count}</span>
        <span className="mt-0.5 block text-[12px] text-text-3">Новые сотрудники ждут подтверждения</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-text-3" />
    </button>
  );
}
