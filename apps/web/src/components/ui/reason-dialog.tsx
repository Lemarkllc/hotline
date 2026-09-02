import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

/** Замена window.prompt() для сбора текстовой причины (стоп-лист, блокировка,
 * переоткрытие) — нативный prompt() нестилизован, не валидируется и блокирует
 * автоматизацию/тестирование (найдено impeccable-аудитом). required=true — как
 * старый `if (window.prompt(...))`, пустой ввод не даёт подтвердить; required=false —
 * как старое `?? undefined`, пустой ввод отправляет reason: undefined, а не "". */
export function ReasonDialog({
  open,
  onClose,
  title,
  description,
  placeholder,
  confirmLabel = "Подтвердить",
  required = false,
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  placeholder?: string;
  confirmLabel?: string;
  required?: boolean;
  pending?: boolean;
  onConfirm: (reason: string | undefined) => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  const trimmed = reason.trim();

  async function handleConfirm() {
    if (required && !trimmed) return;
    await onConfirm(trimmed || undefined);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <Textarea
          rows={3}
          autoFocus
          className="mt-4 min-h-20"
          placeholder={placeholder}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отменить
          </Button>
          <Button disabled={(required && !trimmed) || pending} onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
