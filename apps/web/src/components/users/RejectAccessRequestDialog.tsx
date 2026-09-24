import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

/**
 * Два исхода отказа (реальный кейс 2026-09-24 — заявки с "/vpn" вместо ФИО вместо
 * бана): мягкий (по умолчанию) — сотрудник получает причину в Telegram и может
 * подать заявку заново через /start; окончательный — для спама/не-сотрудников,
 * повторная регистрация недоступна (тот же смысл, что и обычная блокировка).
 * Причина всегда отправляется сотруднику — раньше собиралась, но не доходила.
 */
export function RejectAccessRequestDialog({
  open,
  onClose,
  fullName,
  pending,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  fullName: string;
  pending: boolean;
  onConfirm: (reason: string | undefined, permanent: boolean) => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [permanent, setPermanent] = useState(false);

  function handleClose() {
    setReason("");
    setPermanent(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent>
        <DialogTitle>Отклонить заявку — {fullName}</DialogTitle>
        <DialogDescription>
          Комментарий отправится сотруднику в Telegram, чтобы он понимал причину и мог исправить данные.
        </DialogDescription>
        <Textarea
          rows={3}
          autoFocus
          className="mt-4 min-h-20"
          placeholder="Например: неверно указано ФИО, отправьте настоящее"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <label className="mt-4 flex items-center gap-3">
          <Switch checked={permanent} onCheckedChange={setPermanent} />
          <span className="flex flex-col">
            <Label className="cursor-pointer">Окончательный отказ</Label>
            <span className="text-meta text-text-3">
              {permanent
                ? "Повторная регистрация будет недоступна (для спама/посторонних)."
                : "Сотрудник сможет подать заявку заново через /start."}
            </span>
          </span>
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Отменить
          </Button>
          <Button
            variant={permanent ? "destructive" : "default"}
            disabled={pending}
            onClick={async () => {
              await onConfirm(reason.trim() || undefined, permanent);
              handleClose();
            }}
          >
            {permanent ? "Отклонить окончательно" : "Отклонить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
