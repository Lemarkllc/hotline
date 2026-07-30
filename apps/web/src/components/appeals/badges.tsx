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

const STATUS_VARIANT: Record<AppealStatus, "default" | "warning" | "success"> = {
  OPEN: "default",
  UNDER_REVIEW: "warning",
  IN_PROGRESS: "warning",
  CLOSED: "success",
};

export function StatusBadge({ status }: { status: AppealStatus }) {
  const variant = STATUS_VARIANT[status];
  return (
    <Badge variant={variant === "default" ? "outline" : variant}>{APPEAL_STATUS_LABELS[status]}</Badge>
  );
}

/** Сплошные hex вместо Tailwind-вариантов Badge выше — мобильные пилюли
 * (design_handoff_mobile_pwa) заливные (белый текст на цветном фоне), а не
 * мягкий tint-стиль десктопной Badge; общая палитра та же (tailwind.config.ts). */
export const STATUS_HEX: Record<AppealStatus, string> = {
  OPEN: "#2563EB",
  UNDER_REVIEW: "#D97706",
  IN_PROGRESS: "#1E40AF",
  CLOSED: "#16A34A",
};

export function statusColor(status: AppealStatus): string {
  return STATUS_HEX[status] ?? "#64748B";
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
