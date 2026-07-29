import { AccessRequestsCard } from "@/components/users/AccessRequestsCard";

/** Узкая страница для HRD без user.manage — только заявки на доступ, без остального
 * "Пользователи" (редактирование/блокировка/сброс пароля остаются у Administrator).
 * См. userService.requireHrdOrAdmin на бэкенде. */
export function AccessRequestsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Заявки на доступ</h1>
      <AccessRequestsCard />
    </div>
  );
}
