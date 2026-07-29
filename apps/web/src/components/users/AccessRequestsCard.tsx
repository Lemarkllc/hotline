import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAccessRequests, useApproveAccessRequest, useRejectAccessRequest } from "@/hooks/api";

/** Общий блок "Заявки на подтверждение" — используется и на "Пользователи" (Administrator),
 * и на отдельной странице "Заявки на доступ" (HRD, без остального user.manage). Один
 * источник UI вместо копипасты, backend уже одинаково пускает оба через
 * userService.requireHrdOrAdmin. */
export function AccessRequestsCard() {
  const { data: requests } = useAccessRequests();
  const approve = useApproveAccessRequest();
  const reject = useRejectAccessRequest();

  return (
    <Card>
      <CardContent className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Заявки на подтверждение</h2>
        {!requests?.length && <p className="text-sm text-muted-foreground">Заявок нет.</p>}
        <div className="flex flex-col gap-2">
          {requests?.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">{r.fullName}</p>
                <p className="text-xs text-muted-foreground">telegramId: {r.telegramId}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => approve.mutate(r.id)} disabled={approve.isPending}>
                  Подтвердить
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => reject.mutate({ id: r.id })}
                  disabled={reject.isPending}
                >
                  Отклонить
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
