import { EyeOff, ShieldCheck } from "lucide-react";
import {
  APPEAL_MODE_LABELS,
  APPEAL_STATUS_LABELS,
  EMPLOYEE_APPEAL_TYPE_LABELS,
  type AppealMode,
  type AppealStatus,
  type EmployeeAppealType,
} from "@hotline/shared";
import { Badge } from "@/components/ui/badge";

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
  return <span>{EMPLOYEE_APPEAL_TYPE_LABELS[type as EmployeeAppealType] ?? type}</span>;
}

export { APPEAL_MODE_LABELS };
