import { EyeOff, ShieldCheck } from "lucide-react";
import {
  APPEAL_MODE_LABELS,
  APPEAL_STATUS_LABELS,
  CUSTOMER_APPEAL_TYPE_LABELS,
  EMPLOYEE_APPEAL_TYPE_LABELS,
  type AppealMode,
  type AppealStatus,
} from "@hotline/shared";
import { Badge } from "@/components/ui/badge";

// Объединённая карта вместо только EMPLOYEE — иначе тип клиентского обращения
// (Фаза 7) отображался бы как есть только по случайному совпадению текста
// (COMPLAINT/GRATITUDE у обоих каналов читаются одинаково, но это не гарантия).
export const APPEAL_TYPE_LABELS: Record<string, string> = {
  ...EMPLOYEE_APPEAL_TYPE_LABELS,
  ...CUSTOMER_APPEAL_TYPE_LABELS,
};

/** Единственный источник правды по цвету статуса обращения (UI_REWORK_BRIEF.md §A1
 * зафиксировал, что раньше их было три: STATUS_VARIANT/STATUS_HEX здесь и STATUS_COLORS
 * на DashboardPage.tsx рисовали один и тот же статус по-разному). Значения — светлая
 * тема токенов Lemark One (design_rework/ui_kit/tokens.css); тёмная тема применяется
 * автоматически для DOM-элементов через Tailwind-классы status-*, но Recharts принимает
 * только строковый литерал цвета (не CSS-переменную и не класс), поэтому statusColor()
 * ниже — единственное законное место, где статусный hex зашит буквально. */
const STATUS_VARIANT: Record<AppealStatus, "default" | "warning" | "progress" | "success"> = {
  OPEN: "default",
  UNDER_REVIEW: "warning",
  IN_PROGRESS: "progress",
  CLOSED: "success",
};

export function StatusBadge({ status }: { status: AppealStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{APPEAL_STATUS_LABELS[status]}</Badge>;
}

const STATUS_HEX: Record<AppealStatus, string> = {
  OPEN: "#4A5568",
  UNDER_REVIEW: "#96631A",
  IN_PROGRESS: "#0F5C57",
  CLOSED: "#2F6B4F",
};

/** Для Recharts (заливка графиков) и мобильных заливных пилюль
 * (design_handoff_mobile_pwa), которым нужен литерал цвета, а не Tailwind-класс. */
export function statusColor(status: AppealStatus): string {
  return STATUS_HEX[status] ?? "#6E6C68";
}

/** Конфиденциальный маркер — единственный сознательный цветовой акцент дизайн-системы (PLAN.md §5). */
export function ModeBadge({ mode }: { mode: AppealMode }) {
  if (mode === "CONFIDENTIAL") {
    return (
      <Badge variant="confidential">
        <EyeOff className="size-3" /> Конфиденциально
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <ShieldCheck className="size-3" /> Открыто
    </Badge>
  );
}

export function TypeLabel({ type }: { type: string }) {
  return <span>{APPEAL_TYPE_LABELS[type] ?? type}</span>;
}

export { APPEAL_MODE_LABELS };
