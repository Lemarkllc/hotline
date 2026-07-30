import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

/** Мобильный bottom sheet (выбор ответственного и т.п., см. design_handoff_mobile_pwa) —
 * тот же примитив Radix Dialog, что и обычный Dialog, только слайд снизу вместо
 * центрированного модала. Отдельный компонент, а не вариант пропсов у Dialog — анимация
 * и позиционирование принципиально другие (fixed bottom, rounded только сверху). */
export const BottomSheet = DialogPrimitive.Root;
export const BottomSheetTrigger = DialogPrimitive.Trigger;

export function BottomSheetContent({ className, children, ...props }: DialogPrimitive.DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-foreground/40 data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-[20px] border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(15,23,42,0.15)]",
          "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
          className,
        )}
        {...props}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border" />
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export const BottomSheetTitle = DialogPrimitive.Title;
