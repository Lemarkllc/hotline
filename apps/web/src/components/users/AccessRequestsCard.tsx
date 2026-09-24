import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RejectAccessRequestDialog } from "@/components/users/RejectAccessRequestDialog";
import { useAccessRequests, useApproveAccessRequest, useRejectAccessRequest } from "@/hooks/api";

/** Общий блок "Заявки на подтверждение" — используется и на "Пользователи" (Administrator),
 * и на отдельной странице "Заявки на доступ" (HRD, без остального user.manage). Один
 * источник UI вместо копипасты, backend уже одинаково пускает оба через
 * userService.requireHrdOrAdmin. */
export function AccessRequestsCard() {
  const { data: requests } = useAccessRequests();
  const approve = useApproveAccessRequest();
  const reject = useRejectAccessRequest();
  const [rejectTarget, setRejectTarget] = useState<{ id: string; fullName: string } | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Заявки на подтверждение</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {!requests?.length && <p className="text-ui text-text-3">Заявок нет.</p>}
        {requests?.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-md border border-rule p-3">
            <div>
              <p className="text-ui font-medium text-text-1">{r.fullName}</p>
              <p className="text-meta text-text-3">telegramId: {r.telegramId}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => approve.mutate(r.id)} disabled={approve.isPending}>
                Подтвердить
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRejectTarget({ id: r.id, fullName: r.fullName })}>
                Отклонить
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      <RejectAccessRequestDialog
        open={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        fullName={rejectTarget?.fullName ?? ""}
        pending={reject.isPending}
        onConfirm={async (reason, permanent) => {
          if (!rejectTarget) return;
          await reject.mutateAsync({ id: rejectTarget.id, reason, permanent });
        }}
      />
    </Card>
  );
}
