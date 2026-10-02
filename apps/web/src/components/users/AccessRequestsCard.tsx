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
          // На телефоне (PWA) кнопки уходят под имя и растягиваются на всю ширину — в одну
          // строку с длинным ФИО они не помещались; с md и шире — прежняя строка.
          <div
            key={r.id}
            className="flex flex-col gap-3 rounded-md border border-rule p-3 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p className="text-ui font-medium text-text-1">{r.fullName}</p>
              <p className="text-meta text-text-3">
                {new Date(r.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                {" · "}telegramId: {r.telegramId}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 md:flex">
              <Button
                className="min-h-touch md:min-h-0"
                size="sm"
                onClick={() => approve.mutate(r.id)}
                disabled={approve.isPending}
              >
                Подтвердить
              </Button>
              <Button
                className="min-h-touch md:min-h-0"
                size="sm"
                variant="outline"
                onClick={() => setRejectTarget({ id: r.id, fullName: r.fullName })}
              >
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
