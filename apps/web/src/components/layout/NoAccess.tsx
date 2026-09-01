import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Общий экран "нет прав" — RequirePermission и RequireRole показывают его при
 * прямом переходе по URL (закладка, ссылка), на который у роли нет доступа.
 * Sidebar уже прячет такие пункты меню, но это не защита от прямого адреса —
 * бэкенд всё равно вернёт 403, здесь просто явное сообщение вместо пустой
 * страницы, маскирующейся под "данных нет". */
export function NoAccess() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-status-overdue-tint">
        <ShieldAlert className="size-6 text-status-overdue" strokeWidth={1.5} />
      </div>
      <p className="text-head font-semibold text-text-1">Доступ запрещён</p>
      <p className="max-w-[360px] text-ui text-text-3">
        Для этого раздела нужны права, которых нет у вашей роли. Если это ошибка — обратитесь к
        администратору.
      </p>
      <Button asChild variant="outline" className="mt-2">
        <Link to="/dashboard">На главную</Link>
      </Button>
    </div>
  );
}
