import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

interface PopoverContentProps extends React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> {
  /** false — рендерить без Portal (по умолчанию — с ним). Нужно для попапов внутри
   * Radix Dialog: Dialog в открытом состоянии ставит body{pointer-events:none} и
   * возвращает pointer-events только своему собственному DOM-поддереву — портал,
   * смонтированный прямо в body, физически становится СОСЕДОМ диалога, а не его
   * потомком, и не получает это исключение (клики по нему не доходят, найдено
   * вживую на DatePicker внутри диалога редактирования остатка отпуска). Без Portal
   * контент рендерится там же, где и в JSX-дереве — то есть внутри DialogContent,
   * если попап открыт из диалога, и наследует его pointer-events. */
  portal?: boolean;
}

export const PopoverContent = React.forwardRef<React.ElementRef<typeof PopoverPrimitive.Content>, PopoverContentProps>(
  ({ className, align = "start", sideOffset = 6, portal = true, ...props }, ref) => {
    const content = (
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 rounded-md border border-rule bg-surface shadow-3 outline-none",
          "data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out",
          className,
        )}
        {...props}
      />
    );
    return portal ? <PopoverPrimitive.Portal>{content}</PopoverPrimitive.Portal> : content;
  },
);
PopoverContent.displayName = PopoverPrimitive.Content.displayName;
