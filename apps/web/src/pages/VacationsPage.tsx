import { useState } from "react";
import { BUSINESS_TRIP_TRANSPORT_LABELS, VACATION_STATUS_LABELS } from "@hotline/shared";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReasonDialog } from "@/components/ui/reason-dialog";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AttachmentGallery } from "@/components/attachments/AttachmentGallery";
import { useAuthStore } from "@/lib/authStore";
import {
  useAbsenceRequests,
  useApproveAbsenceRequest,
  useApproveBusinessTripRequest,
  useApproveVacationRequest,
  useAttachmentUrl,
  useBusinessTripRequests,
  useEmployeeBalances,
  useProcessTermination,
  useProcessVacation,
  useRejectAbsenceRequest,
  useRejectBusinessTripRequest,
  useRejectVacationRequest,
  useTerminationsAwaitingProcessing,
  useUpdateEmployeeBalance,
  useUpdateTerminationChecklist,
  useUpdateVacationChecklist,
  useVacationAttachmentUrl,
  useVacationRequests,
  type AbsenceRequestDTO,
  type AppealDTO,
  type BusinessTripRequestDTO,
  type EmployeeBalanceDTO,
  type VacationRequestDTO,
} from "@/hooks/api";

type HrStatus = VacationRequestDTO["status"];

const STATUS_VARIANT: Record<HrStatus, BadgeProps["variant"]> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function DecisionNote({ status, decidedBy, decisionReason }: { status: HrStatus; decidedBy: { fullName: string } | null; decisionReason: string | null }) {
  return (
    <>
      <Badge variant={STATUS_VARIANT[status]}>{VACATION_STATUS_LABELS[status]}</Badge>
      {status !== "PENDING" && decidedBy && (
        <p className="mt-1 text-meta text-text-3">
          {decidedBy.fullName}
          {decisionReason ? ` — ${decisionReason}` : ""}
        </p>
      )}
    </>
  );
}

/** Пара «подпись/значение» в карточке деталей — полный текст, без обрезания
 * (в отличие от ячеек таблицы реестра, где длинный комментарий/цель усекаются
 * truncate — найдено вживую пользователем, отсюда и сама карточка). */
function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  // value иногда — узел с собственным <p> внутри (DecisionNote для "Статус"), поэтому
  // обёртка — div, не p: <p> внутри <p> невалиден в DOM (найдено вживую — React
  // предупреждал в консоли о validateDOMNesting).
  return (
    <div className="flex flex-col gap-0.5">
      <p className="font-mono text-label uppercase tracking-wide text-text-3">{label}</p>
      <div className="whitespace-pre-wrap text-ui text-text-1">{value}</div>
    </div>
  );
}

function DetailActions({
  status,
  pending,
  onApprove,
  onReject,
}: {
  status: HrStatus;
  pending: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  if (status !== "PENDING") return null;
  return (
    <DialogFooter>
      <Button variant="outline" disabled={pending} onClick={onReject}>
        Отклонить
      </Button>
      <Button disabled={pending} onClick={onApprove}>
        Одобрить
      </Button>
    </DialogFooter>
  );
}

/** Фильтр статуса — общий для всех трёх реестров раздела (Отпуска/Отсутствия/
 * Командировки). Дефолт "PENDING", не "Все" — тот же принцип, что у "Активные" в
 * реестре обращений: список без фильтра быстро заполняется завершёнными заявками
 * и хоронит те, что реально ждут решения (найдено пользователем вживую — сказано
 * заранее, до того как это стало проблемой на практике). */
function StatusFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Статус" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="PENDING">На рассмотрении</SelectItem>
        <SelectItem value="all">Все статусы</SelectItem>
        <SelectItem value="APPROVED">Одобрено</SelectItem>
        <SelectItem value="REJECTED">Отклонено</SelectItem>
      </SelectContent>
    </Select>
  );
}

function VacationsTab() {
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const status = statusFilter === "all" ? undefined : (statusFilter as HrStatus);
  const { data: requests } = useVacationRequests(status);
  const approve = useApproveVacationRequest();
  const reject = useRejectVacationRequest();
  const [selected, setSelected] = useState<VacationRequestDTO | null>(null);
  const [rejectTarget, setRejectTarget] = useState<VacationRequestDTO | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <StatusFilter value={statusFilter} onChange={setStatusFilter} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>№</TableHead>
            <TableHead>Сотрудник</TableHead>
            <TableHead>Даты</TableHead>
            <TableHead>Тип</TableHead>
            <TableHead>Комментарий</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests?.map((r) => (
            <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
              <TableCell className="font-mono tabular-nums text-text-3">{r.publicNumber}</TableCell>
              <TableCell>{r.user.fullName}</TableCell>
              <TableCell className="font-mono tabular-nums">
                {formatDate(r.dateFrom)} – {formatDate(r.dateTo)}
              </TableCell>
              <TableCell>{r.paid ? "Оплачиваемый" : "За свой счёт"}</TableCell>
              <TableCell className="max-w-xs truncate text-text-3">{r.comment ?? "—"}</TableCell>
              <TableCell>
                <DecisionNote status={r.status} decidedBy={r.decidedBy} decisionReason={r.decisionReason} />
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                {r.status === "PENDING" && (
                  <div className="flex gap-2">
                    <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(r.id)}>
                      Одобрить
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setRejectTarget(r)}>
                      Отклонить
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!requests?.length && (
        <p className="text-ui text-text-3">
          {statusFilter === "all" ? "Заявок на отпуск пока нет." : "По выбранному статусу заявок нет."}
        </p>
      )}

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogTitle>{selected.publicNumber}</DialogTitle>
              <div className="mt-4 flex flex-col gap-3">
                <DetailField label="Сотрудник" value={selected.user.fullName} />
                <DetailField label="Даты" value={`${formatDate(selected.dateFrom)} – ${formatDate(selected.dateTo)}`} />
                <DetailField label="Тип" value={selected.paid ? "Оплачиваемый" : "За свой счёт"} />
                <DetailField label="Комментарий" value={selected.comment ?? "—"} />
                <DetailField
                  label="Статус"
                  value={<DecisionNote status={selected.status} decidedBy={selected.decidedBy} decisionReason={selected.decisionReason} />}
                />
              </div>
              <DetailActions
                status={selected.status}
                pending={approve.isPending || reject.isPending}
                onApprove={() => {
                  approve.mutate(selected.id);
                  setSelected(null);
                }}
                onReject={() => {
                  setRejectTarget(selected);
                  setSelected(null);
                }}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      <ReasonDialog
        open={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        title={rejectTarget ? `Отклонить заявку ${rejectTarget.publicNumber}` : "Отклонить заявку"}
        description="Причина обязательна и будет видна сотруднику."
        placeholder="Причина отказа…"
        confirmLabel="Отклонить"
        required
        pending={reject.isPending}
        onConfirm={async (reason) => {
          if (!rejectTarget || !reason) return;
          await reject.mutateAsync({ id: rejectTarget.id, reason });
          setRejectTarget(null);
        }}
      />
    </div>
  );
}

function AbsencesTab() {
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const status = statusFilter === "all" ? undefined : (statusFilter as HrStatus);
  const { data: requests } = useAbsenceRequests(status);
  const approve = useApproveAbsenceRequest();
  const reject = useRejectAbsenceRequest();
  const [selected, setSelected] = useState<AbsenceRequestDTO | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AbsenceRequestDTO | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <StatusFilter value={statusFilter} onChange={setStatusFilter} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>№</TableHead>
            <TableHead>Сотрудник</TableHead>
            <TableHead>Дата</TableHead>
            <TableHead>Время</TableHead>
            <TableHead>Причина</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests?.map((r) => (
            <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
              <TableCell className="font-mono tabular-nums text-text-3">{r.publicNumber}</TableCell>
              <TableCell>{r.user.fullName}</TableCell>
              <TableCell className="font-mono tabular-nums">{formatDate(r.date)}</TableCell>
              <TableCell className="font-mono tabular-nums">
                {r.fullDay ? "Весь день" : `${r.timeFrom}–${r.timeTo}`}
              </TableCell>
              <TableCell className="max-w-xs truncate text-text-3">{r.reason ?? "—"}</TableCell>
              <TableCell>
                <DecisionNote status={r.status} decidedBy={r.decidedBy} decisionReason={r.decisionReason} />
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                {r.status === "PENDING" && (
                  <div className="flex gap-2">
                    <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(r.id)}>
                      Одобрить
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setRejectTarget(r)}>
                      Отклонить
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!requests?.length && (
        <p className="text-ui text-text-3">
          {statusFilter === "all" ? "Заявок на отсутствие пока нет." : "По выбранному статусу заявок нет."}
        </p>
      )}

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogTitle>{selected.publicNumber}</DialogTitle>
              <div className="mt-4 flex flex-col gap-3">
                <DetailField label="Сотрудник" value={selected.user.fullName} />
                <DetailField label="Дата" value={formatDate(selected.date)} />
                <DetailField label="Время" value={selected.fullDay ? "Весь день" : `${selected.timeFrom}–${selected.timeTo}`} />
                <DetailField label="Причина" value={selected.reason ?? "—"} />
                <DetailField
                  label="Статус"
                  value={<DecisionNote status={selected.status} decidedBy={selected.decidedBy} decisionReason={selected.decisionReason} />}
                />
              </div>
              <DetailActions
                status={selected.status}
                pending={approve.isPending || reject.isPending}
                onApprove={() => {
                  approve.mutate(selected.id);
                  setSelected(null);
                }}
                onReject={() => {
                  setRejectTarget(selected);
                  setSelected(null);
                }}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      <ReasonDialog
        open={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        title={rejectTarget ? `Отклонить заявку ${rejectTarget.publicNumber}` : "Отклонить заявку"}
        description="Причина обязательна и будет видна сотруднику."
        placeholder="Причина отказа…"
        confirmLabel="Отклонить"
        required
        pending={reject.isPending}
        onConfirm={async (reason) => {
          if (!rejectTarget || !reason) return;
          await reject.mutateAsync({ id: rejectTarget.id, reason });
          setRejectTarget(null);
        }}
      />
    </div>
  );
}

function BusinessTripsTab() {
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const status = statusFilter === "all" ? undefined : (statusFilter as HrStatus);
  const { data: requests } = useBusinessTripRequests(status);
  const approve = useApproveBusinessTripRequest();
  const reject = useRejectBusinessTripRequest();
  const [selected, setSelected] = useState<BusinessTripRequestDTO | null>(null);
  const [rejectTarget, setRejectTarget] = useState<BusinessTripRequestDTO | null>(null);

  function transportLabel(r: BusinessTripRequestDTO): string {
    return BUSINESS_TRIP_TRANSPORT_LABELS[r.transport] + (r.transport === "OTHER" && r.transportOther ? ` (${r.transportOther})` : "");
  }

  return (
    <div className="flex flex-col gap-4">
      <StatusFilter value={statusFilter} onChange={setStatusFilter} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>№</TableHead>
            <TableHead>Сотрудник</TableHead>
            <TableHead>Даты</TableHead>
            <TableHead>Цель</TableHead>
            <TableHead>Транспорт</TableHead>
            <TableHead>Отель</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests?.map((r) => (
            <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
              <TableCell className="font-mono tabular-nums text-text-3">{r.publicNumber}</TableCell>
              <TableCell>{r.user.fullName}</TableCell>
              <TableCell className="font-mono tabular-nums">
                {formatDate(r.dateFrom)} – {formatDate(r.dateTo)}
              </TableCell>
              <TableCell className="max-w-xs truncate text-text-3">{r.purpose}</TableCell>
              <TableCell>{transportLabel(r)}</TableCell>
              <TableCell>{r.hotelNeeded ? "Нужен" : "Не нужен"}</TableCell>
              <TableCell>
                <DecisionNote status={r.status} decidedBy={r.decidedBy} decisionReason={r.decisionReason} />
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                {r.status === "PENDING" && (
                  <div className="flex gap-2">
                    <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(r.id)}>
                      Одобрить
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setRejectTarget(r)}>
                      Отклонить
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!requests?.length && (
        <p className="text-ui text-text-3">
          {statusFilter === "all" ? "Заявок на командировку пока нет." : "По выбранному статусу заявок нет."}
        </p>
      )}

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogTitle>{selected.publicNumber}</DialogTitle>
              <div className="mt-4 flex flex-col gap-3">
                <DetailField label="Сотрудник" value={selected.user.fullName} />
                <DetailField label="Даты" value={`${formatDate(selected.dateFrom)} – ${formatDate(selected.dateTo)}`} />
                <DetailField label="Цель" value={selected.purpose} />
                <DetailField label="Транспорт" value={transportLabel(selected)} />
                <DetailField label="Отель" value={selected.hotelNeeded ? "Нужен" : "Не нужен"} />
                <DetailField
                  label="Статус"
                  value={<DecisionNote status={selected.status} decidedBy={selected.decidedBy} decisionReason={selected.decisionReason} />}
                />
              </div>
              <DetailActions
                status={selected.status}
                pending={approve.isPending || reject.isPending}
                onApprove={() => {
                  approve.mutate(selected.id);
                  setSelected(null);
                }}
                onReject={() => {
                  setRejectTarget(selected);
                  setSelected(null);
                }}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      <ReasonDialog
        open={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        title={rejectTarget ? `Отклонить заявку ${rejectTarget.publicNumber}` : "Отклонить заявку"}
        description="Причина обязательна и будет видна сотруднику."
        placeholder="Причина отказа…"
        confirmLabel="Отклонить"
        required
        pending={reject.isPending}
        onConfirm={async (reason) => {
          if (!rejectTarget || !reason) return;
          await reject.mutateAsync({ id: rejectTarget.id, reason });
          setRejectTarget(null);
        }}
      />
    </div>
  );
}

function formatDateIso(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** "YYYY-MM-DDTHH:mm:ss.sssZ" -> "YYYY-MM-DD" для DatePicker (тот работает с чистой
 * календарной датой, без времени/зоны — как и hireDate/asOfDate по смыслу). */
function toDateOnly(iso: string | null): string | null {
  return iso ? iso.slice(0, 10) : null;
}

function EmployeeBalanceDialog({ employee, onClose }: { employee: EmployeeBalanceDTO; onClose: () => void }) {
  const update = useUpdateEmployeeBalance();
  const [hireDate, setHireDate] = useState<string | null>(toDateOnly(employee.hireDate));
  const [startingBalance, setStartingBalance] = useState(
    employee.startingBalance !== null ? String(employee.startingBalance) : "",
  );
  const [balanceAsOfDate, setBalanceAsOfDate] = useState<string | null>(
    toDateOnly(employee.balanceAsOfDate) ?? new Date().toISOString().slice(0, 10),
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({
      id: employee.id,
      hireDate,
      // Оба поля отправляются только вместе — стартовый остаток без даты снимка
      // бессмысленен для формулы (utils/vacationBalance.ts на бэкенде).
      ...(startingBalance.trim() && balanceAsOfDate
        ? { startingBalance: Number(startingBalance), balanceAsOfDate }
        : {}),
    });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>{employee.fullName}</DialogTitle>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label>Дата приёма на работу</Label>
            <DatePicker value={hireDate} onChange={setHireDate} />
            <p className="text-meta text-text-3">Источник для расчёта остатка отпуска.</p>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="startingBalance">Остаток отпуска на дату (дней)</Label>
            <div className="flex gap-2">
              <Input
                id="startingBalance"
                type="number"
                min="0"
                step="0.01"
                value={startingBalance}
                onChange={(e) => setStartingBalance(e.target.value)}
                placeholder="не задан"
                className="w-32"
              />
              <DatePicker value={balanceAsOfDate} onChange={setBalanceAsOfDate} disabled={!startingBalance.trim()} />
            </div>
            <p className="text-meta text-text-3">
              Разовый снимок из кадровых данных — остаток на сегодня считается формулой от него.
            </p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={update.isPending}>
              Сохранить
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Узкий HRD-доступ (vacation.manage) к дате приёма/остатку отпуска — отдельно от
 * полного списка пользователей (/users, user.manage, только Администратор). HRD не
 * видит и не может менять роли/блокировку/каналы, только эти два кадровых поля. */
function EmployeeBalancesTab() {
  const { data: employees } = useEmployeeBalances();
  const [editTarget, setEditTarget] = useState<EmployeeBalanceDTO | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Сотрудник</TableHead>
            <TableHead>Дата приёма</TableHead>
            <TableHead>Остаток (дней)</TableHead>
            <TableHead>Снимок на дату</TableHead>
            <TableHead>Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees?.map((e) => (
            <TableRow key={e.id}>
              <TableCell>{e.fullName}</TableCell>
              <TableCell className="font-mono tabular-nums">{e.hireDate ? formatDateIso(e.hireDate) : "—"}</TableCell>
              <TableCell className="font-mono tabular-nums">
                {e.availableDays === null ? (
                  <span className="text-text-3">не настроен</span>
                ) : (
                  e.availableDays
                )}
              </TableCell>
              <TableCell className="font-mono tabular-nums">
                {e.balanceAsOfDate ? formatDateIso(e.balanceAsOfDate) : "—"}
              </TableCell>
              <TableCell>
                <Button size="sm" variant="outline" onClick={() => setEditTarget(e)}>
                  Изменить
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!employees?.length && <p className="text-ui text-text-3">Активных сотрудников не найдено.</p>}

      {editTarget && <EmployeeBalanceDialog employee={editTarget} onClose={() => setEditTarget(null)} />}
    </div>
  );
}

/** Бейдж количества PENDING-заявок прямо на вкладке — тот же визуальный язык, что и
 * бейдж в Sidebar (bg-status-overdue-tint), только меньше, под текст вкладки. */
function TabBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-status-overdue-tint px-1 font-mono text-[10px] font-semibold text-status-overdue">
      {count}
    </span>
  );
}

function ChecklistCheckbox({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-ui text-text-1">
      <input
        type="checkbox"
        className="size-4 accent-action"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

/** Клик по строке открывает модалку — тот же паттерн, что у VacationsTab выше
 * (Dialog/DetailField): чек-лист и «Оформить» переехали внутрь, вместе с фото
 * заявления и комментариями сотрудника/HRD — карточка-строка сама по себе
 * становится слишком длинной и загромождённой, если держать всё это открытым сразу. */
function VacationProcessingRow({ request }: { request: VacationRequestDTO }) {
  const [open, setOpen] = useState(false);
  const updateChecklist = useUpdateVacationChecklist(request.id);
  const process = useProcessVacation(request.id);
  const getAttachmentUrl = useVacationAttachmentUrl();
  const canProcess = request.applicationDrafted && request.applicationSigned;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-4 rounded-md border border-rule p-4 text-left transition-colors hover:bg-surface-sunk"
      >
        <div>
          <p className="font-medium text-text-1">{request.user.fullName}</p>
          <p className="font-mono text-meta text-text-3">
            {request.publicNumber} · {formatDate(request.dateFrom)} – {formatDate(request.dateTo)}
          </p>
        </div>
        <Badge variant={canProcess ? "success" : "warning"}>{canProcess ? "Готово к оформлению" : "Ожидает"}</Badge>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{request.publicNumber}</DialogTitle>
          <div className="mt-4 flex flex-col gap-3">
            <DetailField label="Сотрудник" value={request.user.fullName} />
            <DetailField label="Даты" value={`${formatDate(request.dateFrom)} – ${formatDate(request.dateTo)}`} />
            <DetailField label="Комментарий сотрудника" value={request.comment ?? "—"} />
            {request.decisionReason && <DetailField label="Комментарий HRD" value={request.decisionReason} />}
            <DetailField
              label="Заявление (фото)"
              value={
                <AttachmentGallery
                  attachments={request.attachments.map((a) => ({
                    id: a.id,
                    mimeType: a.mimeType,
                    fileSize: a.fileSize,
                    label: a.kind === "PHOTO" ? "Фото" : "Видео",
                  }))}
                  getQueryKey={(attachmentId) => ["vacation-attachment-url", request.id, attachmentId]}
                  fetchUrl={(attachmentId, download) =>
                    getAttachmentUrl
                      .mutateAsync({ vacationRequestId: request.id, attachmentId, download })
                      .then((r) => r.url)
                  }
                />
              }
            />
            <DetailField
              label="Чек-лист"
              value={
                <div className="flex flex-col gap-1">
                  <ChecklistCheckbox
                    label="Заявление оформлено"
                    checked={request.applicationDrafted}
                    disabled={updateChecklist.isPending}
                    onChange={(v) => updateChecklist.mutate({ applicationDrafted: v })}
                  />
                  <ChecklistCheckbox
                    label="Заявление подписано"
                    checked={request.applicationSigned}
                    disabled={updateChecklist.isPending}
                    onChange={(v) => updateChecklist.mutate({ applicationSigned: v })}
                  />
                </div>
              }
            />
          </div>
          <DialogFooter>
            <Button
              disabled={!canProcess || process.isPending}
              onClick={() => {
                process.mutate();
                setOpen(false);
              }}
            >
              Оформить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function VacationProcessingList({ requests }: { requests: VacationRequestDTO[] | undefined }) {
  if (!requests?.length) return <p className="text-ui text-text-3">Нет отпусков, ожидающих оформления.</p>;
  return (
    <div className="flex flex-col gap-3">
      {requests.map((r) => (
        <VacationProcessingRow key={r.id} request={r} />
      ))}
    </div>
  );
}

function TerminationProcessingRow({ appeal }: { appeal: AppealDTO }) {
  const [open, setOpen] = useState(false);
  const updateChecklist = useUpdateTerminationChecklist(appeal.id);
  const process = useProcessTermination(appeal.id);
  const getAttachmentUrl = useAttachmentUrl();
  const c = appeal.terminationChecklist;
  const canProcess =
    c.walkoffSheetSigned && c.terminationOrderSigned && c.certificatesIssued && c.terminationApplicationSigned;
  // Финальный ответ HRD при закрытии обращения — обычный комментарий с isFinalAnswer,
  // не отдельное поле (см. appealService.changeStatus, addComment({isFinalAnswer: true})).
  const hrdComment = appeal.comments.find((c2) => c2.isFinalAnswer)?.text;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-4 rounded-md border border-rule p-4 text-left transition-colors hover:bg-surface-sunk"
      >
        <div>
          <p className="font-medium text-text-1">{appeal.author?.fullName ?? "Сотрудник"}</p>
          <p className="font-mono text-meta text-text-3">{appeal.publicNumber}</p>
        </div>
        <Badge variant={canProcess ? "success" : "warning"}>{canProcess ? "Готово к оформлению" : "Ожидает"}</Badge>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{appeal.publicNumber}</DialogTitle>
          <div className="mt-4 flex flex-col gap-3">
            <DetailField label="Сотрудник" value={appeal.author?.fullName ?? "—"} />
            <DetailField label="Заявление сотрудника" value={appeal.originalText} />
            {hrdComment && <DetailField label="Комментарий HRD" value={hrdComment} />}
            <DetailField
              label="Вложения"
              value={
                <AttachmentGallery
                  attachments={appeal.attachments.map((a) => ({
                    id: a.id,
                    mimeType: a.mimeType,
                    fileSize: a.fileSize,
                    label: a.kind === "PHOTO" ? "Фото" : "Видео",
                  }))}
                  getQueryKey={(attachmentId) => ["appeal-attachment-url", appeal.id, attachmentId]}
                  fetchUrl={(attachmentId, download) =>
                    getAttachmentUrl.mutateAsync({ appealId: appeal.id, attachmentId, download }).then((r) => r.url)
                  }
                />
              }
            />
            <DetailField
              label="Чек-лист"
              value={
                <div className="flex flex-col gap-1">
                  <ChecklistCheckbox
                    label="Обходной лист подписан"
                    checked={c.walkoffSheetSigned}
                    disabled={updateChecklist.isPending}
                    onChange={(v) => updateChecklist.mutate({ walkoffSheetSigned: v })}
                  />
                  <ChecklistCheckbox
                    label="Приказ подписан"
                    checked={c.terminationOrderSigned}
                    disabled={updateChecklist.isPending}
                    onChange={(v) => updateChecklist.mutate({ terminationOrderSigned: v })}
                  />
                  <ChecklistCheckbox
                    label="Справки выданы"
                    checked={c.certificatesIssued}
                    disabled={updateChecklist.isPending}
                    onChange={(v) => updateChecklist.mutate({ certificatesIssued: v })}
                  />
                  <ChecklistCheckbox
                    label="Заявление подписано"
                    checked={c.terminationApplicationSigned}
                    disabled={updateChecklist.isPending}
                    onChange={(v) => updateChecklist.mutate({ terminationApplicationSigned: v })}
                  />
                </div>
              }
            />
          </div>
          <DialogFooter>
            <Button
              disabled={!canProcess || process.isPending}
              onClick={() => {
                process.mutate();
                setOpen(false);
              }}
            >
              Оформить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TerminationProcessingList({ appeals }: { appeals: AppealDTO[] | undefined }) {
  if (!appeals?.length) return <p className="text-ui text-text-3">Нет увольнений, ожидающих оформления.</p>;
  return (
    <div className="flex flex-col gap-3">
      {appeals.map((a) => (
        <TerminationProcessingRow key={a.id} appeal={a} />
      ))}
    </div>
  );
}

/** Стадия «Оформление» (роль HR, право hr.process) — отдельно от approve/reject:
 * HR не решает судьбу заявки, только оформляет бумаги после решения HRD. Отпуска/
 * Увольнения — вложенные вкладки с собственными бейджами, тот же паттерн, что у
 * верхнеуровневых Отпуска/Отсутствия/Командировки (см. VacationsPage ниже). */
function ProcessingTab() {
  const { data: vacations } = useVacationRequests("APPROVED", true, false);
  const { data: terminations } = useTerminationsAwaitingProcessing();

  return (
    <Tabs defaultValue="vacations">
      <TabsList>
        <TabsTrigger value="vacations">
          Отпуска
          <TabBadge count={vacations?.length ?? 0} />
        </TabsTrigger>
        <TabsTrigger value="terminations">
          Увольнения
          <TabBadge count={terminations?.length ?? 0} />
        </TabsTrigger>
      </TabsList>
      <TabsContent value="vacations">
        <VacationProcessingList requests={vacations} />
      </TabsContent>
      <TabsContent value="terminations">
        <TerminationProcessingList appeals={terminations} />
      </TabsContent>
    </Tabs>
  );
}

/** Раздел «Отпуска» (PLAN.md §10) — три независимые сущности (VacationRequest/
 * AbsenceRequest/BusinessTripRequest) под одной вкладочной страницей: один смысловой
 * процесс кадрового согласования для HRD, тот же паттерн, что и вкладки карточки
 * обращения (Тред/Обращение/Вложения/Аудит). Пункт меню в сайдбаре называется
 * «Отсутствие» (решение пользователя) — заголовок страницы вторит ему, вкладки внутри
 * остаются как есть: Отпуска/Отсутствия/Командировки. Клик по строке реестра открывает
 * карточку деталей — иначе длинный комментарий/цель обрезаются в ячейке таблицы truncate
 * без способа увидеть их целиком (баг, найденный пользователем вживую). */
export function VacationsPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManageVacations = hasPermission("vacation.manage");
  // Бэкенд разрешает вызывать эндпоинты «Оформления» и HR (hr.process), и HRD
  // (vacation.manage — сохраняет надзор/бэкап-доступ, requireAnyPlainPermission на
  // роуте). Вкладка должна быть видна по тому же ИЛИ, иначе HRD не сможет
  // воспользоваться правом, которое у неё формально есть.
  const canSeeProcessingTab = hasPermission("hr.process") || canManageVacations;

  // Бейджи PENDING на самих вкладках — отдельные лёгкие запросы, не завязаны на
  // состояние конкретной вкладки-таба (та грузит список без фильтра по статусу
  // отдельным хуком внутри своего компонента, см. VacationsTab/AbsencesTab/...).
  const { data: pendingVacations } = useVacationRequests("PENDING", canManageVacations);
  const { data: pendingAbsences } = useAbsenceRequests("PENDING", canManageVacations);
  const { data: pendingBusinessTrips } = useBusinessTripRequests("PENDING", canManageVacations);
  const { data: awaitingVacations } = useVacationRequests("APPROVED", canSeeProcessingTab, false);
  const { data: awaitingTerminations } = useTerminationsAwaitingProcessing(canSeeProcessingTab);
  const awaitingProcessingCount = (awaitingVacations?.length ?? 0) + (awaitingTerminations?.length ?? 0);

  // Роль HR (hr.process, без vacation.manage) не решает судьбу заявок — у неё в этом
  // разделе есть ровно один экран, «Оформление». Оборачивать единственный пункт в
  // Tabs/TabsList рисовало бы бесполезную полоску с одной вкладкой (найдено вживую) —
  // для чистого HR рендерим ProcessingTab напрямую, без внешнего таб-бара. У HRD
  // вкладок несколько (включая «Оформление» как одну из них — она тоже им пользуется),
  // там внешний Tabs остаётся оправданным.
  if (!canManageVacations) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-title font-bold text-text-1">Отсутствие</h1>
        <ProcessingTab />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-title font-bold text-text-1">Отсутствие</h1>

      <Tabs defaultValue="vacations">
        <TabsList>
          <TabsTrigger value="vacations">
            Отпуска
            <TabBadge count={pendingVacations?.length ?? 0} />
          </TabsTrigger>
          <TabsTrigger value="absences">
            Отсутствия
            <TabBadge count={pendingAbsences?.length ?? 0} />
          </TabsTrigger>
          <TabsTrigger value="business-trips">
            Командировки
            <TabBadge count={pendingBusinessTrips?.length ?? 0} />
          </TabsTrigger>
          <TabsTrigger value="processing">
            Оформление
            <TabBadge count={awaitingProcessingCount} />
          </TabsTrigger>
          <TabsTrigger value="balances">Остатки отпуска</TabsTrigger>
        </TabsList>
        <TabsContent value="vacations">
          <VacationsTab />
        </TabsContent>
        <TabsContent value="absences">
          <AbsencesTab />
        </TabsContent>
        <TabsContent value="business-trips">
          <BusinessTripsTab />
        </TabsContent>
        <TabsContent value="processing">
          <ProcessingTab />
        </TabsContent>
        <TabsContent value="balances">
          <EmployeeBalancesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
