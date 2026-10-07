import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronRight, Copy, HelpCircle, Laptop, Plus, Smartphone, Tablet, Trash2 } from "lucide-react";
import { FULL_NAME_FORMAT_HINT, isValidFullName } from "@hotline/shared";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { BottomSheet, BottomSheetContent, BottomSheetTitle } from "@/components/ui/bottom-sheet";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  useAddVpnEmployee,
  useAdminVpnCard,
  useAdminVpnList,
  useCreateVpn,
  useDeleteVpnDevice,
  useDisableVpn,
  useReissueVpn,
  useSendVpnEmail,
  useSetVpnDeviceLimit,
  type AdminVpnDevice,
  type AdminVpnRow,
  type AdminVpnState,
} from "@/hooks/api";

const DEVICE_LIMITS = [1, 2, 3, 4, 5];

const STATE_LABELS: Record<AdminVpnState, string> = {
  ACTIVE: "есть",
  NONE: "нет",
  STALE: "ссылка устарела",
  DISABLED: "отключён администратором",
};

const STATE_VARIANTS: Record<AdminVpnState, "success" | "outline" | "warning" | "destructive"> = {
  ACTIVE: "success",
  NONE: "outline",
  STALE: "warning",
  DISABLED: "destructive",
};

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  const units = ["Б", "КБ", "МБ", "ГБ", "ТБ"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatDate(iso: string, withTime = false): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : { year: "numeric" }),
  });
}

/** «12 ГБ» за полные 30 дней или «3 ГБ за 7 дн. (с 01.10.2026)», пока истории мало. */
function traffic30Label(t: AdminVpnRow["traffic30"]): string {
  if (!t.since) return "нет данных";
  if (t.full) return formatBytes(t.bytes);
  return `${formatBytes(t.bytes)} за ${t.days} дн. (с ${formatDate(t.since)})`;
}

/** Колонка «Устройства»: число из ночного снимка; пока снимка нет — хотя бы лимит. */
function devicesLabel(row: AdminVpnRow): string {
  if (row.state === "NONE" || row.state === "DISABLED") return "нет VPN";
  if (row.state === "STALE") return "не работает";
  if (!row.devices) return `лимит ${row.deviceLimit ?? "—"}`;
  return `${row.devices.count} из ${row.deviceLimit ?? "—"}`;
}

const DEVICES_PENDING_HINT = "Число устройств появится после снимка; точный список — в карточке сотрудника";

const DEVICE_ICONS = { phone: Smartphone, tablet: Tablet, computer: Laptop, unknown: HelpCircle } as const;

function DeviceIcon({ kind }: { kind: AdminVpnDevice["kind"] }) {
  const Icon = DEVICE_ICONS[kind] ?? HelpCircle;
  return <Icon className="size-5 shrink-0 text-text-3" aria-hidden />;
}

/** «5 мин назад», «3 ч назад», «вчера», «12 дн. назад» — по последнему обновлению подписки. */
function relativeTime(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (minutes < 2) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.round(hours / 24);
  if (days === 1) return "вчера";
  return `${days} дн. назад`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Не получилось — попробуйте ещё раз";
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Скопировано" : label}
    </Button>
  );
}

/** Подтверждение необратимых действий (перевыпуск, отключение). */
function ConfirmDialog(props: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={props.open} onOpenChange={(v) => !v && props.onClose()}>
      <DialogContent>
        <DialogTitle>{props.title}</DialogTitle>
        <DialogDescription>{props.description}</DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={props.onClose}>
            Отмена
          </Button>
          <Button variant="destructive" disabled={props.pending} onClick={props.onConfirm}>
            {props.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ADD_OUTCOME_TEXT = {
  created: "Сотрудник добавлен, VPN выдан.",
  approved: "Заявка на доступ одобрена, VPN выдан.",
  reactivated: "Сотрудник снова активен, VPN выдан.",
  already_active: "Сотрудник уже был активен — VPN выдан (если его не было).",
} as const;

function AddEmployeeDialog({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (userId: string) => void }) {
  const add = useAddVpnEmployee();
  const [telegramId, setTelegramId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [deviceLimit, setDeviceLimit] = useState("2");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<{ userId: string; text: string } | null>(null);

  const telegramIdValid = /^\d{5,15}$/.test(telegramId.trim());
  const fullNameValid = isValidFullName(fullName);

  function reset() {
    setTelegramId("");
    setFullName("");
    setEmail("");
    setDeviceLimit("2");
    setTouched(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!telegramIdValid || !fullNameValid) return;
    setError(null);
    try {
      const result = await add.mutateAsync({
        telegramId: telegramId.trim(),
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        deviceLimit: Number(deviceLimit),
      });
      reset();
      setAdded({ userId: result.userId, text: ADD_OUTCOME_TEXT[result.outcome] });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          reset();
          setAdded(null);
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogTitle>Добавить сотрудника</DialogTitle>
        <DialogDescription>Сотрудник сразу получит доступ к боту и VPN. Сообщений в Telegram не будет.</DialogDescription>
        {added ? (
          <>
            <p className="mt-4 text-ui text-text-1">{added.text}</p>
            <DialogFooter>
              <Button
                onClick={() => {
                  setAdded(null);
                  onClose();
                  onAdded(added.userId);
                }}
              >
                Открыть карточку
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3" noValidate>
            <div className="flex flex-col gap-1">
              <Label htmlFor="vpnTelegramId">Telegram ID</Label>
              <Input
                id="vpnTelegramId"
                inputMode="numeric"
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value.replace(/\D/g, ""))}
                placeholder="например, 792875477"
              />
              {touched && !telegramIdValid && <p className="text-meta text-status-overdue">Только цифры, 5–15 знаков.</p>}
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="vpnFullName">ФИО</Label>
              <Input id="vpnFullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Иванов Иван Иванович" />
              {touched && !fullNameValid && <p className="text-meta text-status-overdue">{FULL_NAME_FORMAT_HINT}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="vpnEmail">Email (необязательно)</Label>
              <Input id="vpnEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="vpnLimit">Лимит устройств</Label>
              <Select value={deviceLimit} onValueChange={setDeviceLimit}>
                <SelectTrigger id="vpnLimit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEVICE_LIMITS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-meta text-status-overdue">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={add.isPending}>
                {add.isPending ? "Добавляем…" : "Добавить"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-meta font-semibold uppercase tracking-wide text-text-3">{title}</p>
      {children}
    </div>
  );
}

/** Карточка сотрудника: ссылки, письмо, перевыпуск/отключение, устройства, лимит. */
function EmployeeCard({ userId }: { userId: string }) {
  const { data: card, isLoading } = useAdminVpnCard(userId);
  const createVpn = useCreateVpn();
  const reissue = useReissueVpn();
  const disable = useDisableVpn();
  const setLimit = useSetVpnDeviceLimit();
  const deleteDevice = useDeleteVpnDevice();
  const sendEmail = useSendVpnEmail();
  const [confirm, setConfirm] = useState<"reissue" | "disable" | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  if (isLoading || !card) return <p className="text-ui text-text-3">Загрузка…</p>;
  const { row } = card;

  async function run(action: () => Promise<unknown>, success: string) {
    setMessage(null);
    try {
      await action();
      setMessage({ text: success, error: false });
    } catch (err) {
      setMessage({ text: errorMessage(err), error: true });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[17px] font-bold text-text-1">{row.fullName}</p>
        <p className="mt-1 text-meta text-text-3">
          Telegram {row.telegramId}
          {row.panelEmail ? ` · логин ${row.panelEmail}` : ""}
          {row.email ? ` · ${row.email}` : ""}
        </p>
        <Badge className="mt-2" variant={STATE_VARIANTS[row.state]}>
          VPN: {STATE_LABELS[row.state]}
        </Badge>
      </div>

      {message && <p className={message.error ? "text-meta text-status-overdue" : "text-meta text-status-ok"}>{message.text}</p>}

      {row.state === "ACTIVE" && card.subscriptionUrl && card.connectorUrl && (
        <Section title="Ссылки">
          <div className="flex flex-wrap gap-2">
            <CopyButton value={card.subscriptionUrl} label="Ссылка подписки" />
            <CopyButton value={card.connectorUrl} label="Ссылка коннектора" />
            <Button
              variant="outline"
              onClick={() => {
                setEmailValue(row.email ?? "");
                setEmailOpen(true);
              }}
            >
              Отправить по почте
            </Button>
          </div>
        </Section>
      )}

      {(row.state === "NONE" || row.state === "DISABLED") && (
        <Section title="VPN">
          <p className="text-meta text-text-3">
            {row.state === "DISABLED" ? "VPN отключён: сотрудник не может получить его в боте." : "VPN ещё не выдан."}
          </p>
          <div>
            <Button disabled={createVpn.isPending} onClick={() => void run(() => createVpn.mutateAsync({ userId }), "VPN создан.")}>
              {createVpn.isPending ? "Создаём…" : "Создать VPN"}
            </Button>
          </div>
        </Section>
      )}

      {row.state === "ACTIVE" && (
        <Section title="Устройства">
          <div className="flex items-center gap-2 text-ui text-text-1">
            <span>Лимит</span>
            <Select
              value={String(row.deviceLimit ?? 2)}
              onValueChange={(v) => void run(() => setLimit.mutateAsync({ userId, deviceLimit: Number(v) }), `Лимит устройств: ${v}.`)}
              disabled={setLimit.isPending}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEVICE_LIMITS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {card.liveDevices === null ? (
            <p className="text-meta text-text-3">Панель не ответила — устройства не загружены.</p>
          ) : card.liveDevices.length === 0 ? (
            <p className="text-meta text-text-3">Устройств нет.</p>
          ) : (
            <ul className="divide-y divide-rule rounded-md border border-rule">
              {card.liveDevices.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <DeviceIcon kind={d.kind} />
                  <div className="min-w-0 flex-1">
                    <p className="text-ui text-text-1">{d.model ?? "Устройство"}</p>
                    <p className="text-meta text-text-3">
                      {[d.os, d.appVersion ? `${d.app} ${d.appVersion}` : d.app].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-meta text-text-3" title={formatDate(d.lastSeen, true)}>
                      Активно {relativeTime(d.lastSeen)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label="Удалить устройство"
                    disabled={deleteDevice.isPending}
                    onClick={() => void run(() => deleteDevice.mutateAsync({ userId, deviceId: d.id }), "Устройство удалено.")}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {row.state !== "NONE" && row.state !== "DISABLED" && (
        <Section title="Доступ">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setConfirm("reissue")}>
              Перевыпустить ссылку
            </Button>
            <Button variant="outline" className="text-destructive" onClick={() => setConfirm("disable")}>
              Отключить VPN
            </Button>
          </div>
        </Section>
      )}

      <ConfirmDialog
        open={confirm === "reissue"}
        title="Перевыпустить ссылку"
        description={`Старая ссылка и все импортированные конфиги ${row.fullName} перестанут работать, устройства сбросятся. Новую ссылку нужно будет передать сотруднику.`}
        confirmLabel="Перевыпустить"
        pending={reissue.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          void run(() => reissue.mutateAsync(userId), "Ссылка перевыпущена — передайте сотруднику новую.");
        }}
      />
      <ConfirmDialog
        open={confirm === "disable"}
        title="Отключить VPN"
        description={`VPN ${row.fullName} перестанет работать на всех устройствах, получить его в боте будет нельзя. Доступ к боту останется.`}
        confirmLabel="Отключить"
        pending={disable.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          void run(() => disable.mutateAsync(userId), "VPN отключён.");
        }}
      />

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogTitle>Отправить по почте</DialogTitle>
          <DialogDescription>Письмо с кнопкой подключения и ссылкой. Адрес сохранится в карточке сотрудника.</DialogDescription>
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setEmailOpen(false);
              void run(
                () => sendEmail.mutateAsync({ userId, email: emailValue.trim() || undefined }),
                `Письмо отправлено на ${emailValue.trim()}.`,
              );
            }}
          >
            <div className="flex flex-col gap-1">
              <Label htmlFor="vpnSendEmail">Email</Label>
              <Input id="vpnSendEmail" type="email" required value={emailValue} onChange={(e) => setEmailValue(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={sendEmail.isPending || !emailValue.trim()}>
                Отправить
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type SortKey = "name" | "state" | "devices" | "traffic30" | "trafficTotal";

/** Порядок состояний при сортировке «по VPN»: сначала то, что требует действия. */
const STATE_ORDER: AdminVpnState[] = ["STALE", "NONE", "DISABLED", "ACTIVE"];

/** Сравнение по возрастанию; направление применяет страница. Нет данных — всегда в конце. */
const SORTERS: Record<SortKey, (a: AdminVpnRow, b: AdminVpnRow) => number> = {
  name: (a, b) => a.fullName.localeCompare(b.fullName, "ru"),
  state: (a, b) => STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state),
  devices: (a, b) => (a.devices?.count ?? -1) - (b.devices?.count ?? -1),
  traffic30: (a, b) => a.traffic30.bytes - b.traffic30.bytes,
  trafficTotal: (a, b) => (a.trafficTotal ?? -1) - (b.trafficTotal ?? -1),
};

/** Текст и числа — по возрастанию, объёмы и устройства — сначала самые большие. */
const DEFAULT_DESC: Record<SortKey, boolean> = { name: false, state: false, devices: true, traffic30: true, trafficTotal: true };

const SORT_LABELS: Record<SortKey, string> = {
  name: "По ФИО",
  state: "По состоянию VPN",
  devices: "По устройствам",
  traffic30: "По трафику за 30 дней",
  trafficTotal: "По трафику всего",
};

type StateFilter = "ALL" | AdminVpnState;

function SortHead({ label, sortKey, sort, desc, onSort }: { label: string; sortKey: SortKey; sort: SortKey; desc: boolean; onSort: (key: SortKey) => void }) {
  const active = sort === sortKey;
  const Icon = !active ? ArrowUpDown : desc ? ArrowDown : ArrowUp;
  return (
    <TableHead>
      <button type="button" onClick={() => onSort(sortKey)} className={active ? "inline-flex items-center gap-1 text-text-1" : "inline-flex items-center gap-1"}>
        {label}
        <Icon className="size-3.5" />
      </button>
    </TableHead>
  );
}

/** Раздел «VPN» (Администратор, user.manage): десктоп — таблица, PWA — карточки
 * (пункт «VPN-доступы» в Профиле). openspec admin-vpn-management. */
export function VpnAdminPage() {
  const isMobile = useIsMobile();
  const { data, isLoading, error } = useAdminVpnList();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [desc, setDesc] = useState(false);
  const [stateFilter, setStateFilter] = useState<StateFilter>("ALL");
  const [selected, setSelected] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = (data?.rows ?? []).filter(
      (r) => (stateFilter === "ALL" || r.state === stateFilter) && (!q || r.fullName.toLowerCase().includes(q) || r.telegramId.includes(q)),
    );
    const compare = SORTERS[sort];
    // Вторичный ключ — ФИО, чтобы при равных значениях порядок не прыгал.
    return [...filtered].sort((a, b) => (desc ? -compare(a, b) : compare(a, b)) || SORTERS.name(a, b));
  }, [data, query, sort, desc, stateFilter]);

  const stateCounts = useMemo(() => {
    const counts: Record<StateFilter, number> = { ALL: 0, ACTIVE: 0, NONE: 0, STALE: 0, DISABLED: 0 };
    for (const r of data?.rows ?? []) {
      counts.ALL++;
      counts[r.state]++;
    }
    return counts;
  }, [data]);

  /** Клик по той же колонке меняет направление, по новой — её направление по умолчанию. */
  function handleSort(key: SortKey) {
    if (key === sort) {
      setDesc((d) => !d);
    } else {
      setSort(key);
      setDesc(DEFAULT_DESC[key]);
    }
  }

  const lastSnapshotAt = useMemo(() => {
    const times = (data?.rows ?? []).map((r) => r.devices?.at).filter((t): t is string => Boolean(t));
    return times.length ? times.sort().at(-1)! : null;
  }, [data]);

  const card = selected && <EmployeeCard userId={selected} />;

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-title font-bold text-text-1">VPN</h1>
        <Button onClick={() => setAddOpen(true)}>
          <Plus />
          Добавить сотрудника
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input placeholder="Поиск по ФИО или Telegram ID" value={query} onChange={(e) => setQuery(e.target.value)} className="sm:max-w-xs" />
        <div className="flex gap-2">
          <Select
            value={sort}
            onValueChange={(v) => {
              setSort(v as SortKey);
              setDesc(DEFAULT_DESC[v as SortKey]);
            }}
          >
            <SelectTrigger className="flex-1 sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {SORT_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            aria-label={desc ? "По убыванию" : "По возрастанию"}
            title={desc ? "По убыванию" : "По возрастанию"}
            onClick={() => setDesc((d) => !d)}
          >
            {desc ? <ArrowDown /> : <ArrowUp />}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["ALL", "STALE", "NONE", "DISABLED", "ACTIVE"] as StateFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setStateFilter(f)}
            className={
              stateFilter === f
                ? "rounded-full bg-primary px-3 py-1 text-meta font-semibold text-primary-foreground"
                : "rounded-full border border-rule px-3 py-1 text-meta text-text-2"
            }
          >
            {f === "ALL" ? "Все" : STATE_LABELS[f]} · {stateCounts[f]}
          </button>
        ))}
      </div>

      {data && !data.panelAvailable && (
        <p className="text-meta text-status-overdue">Панель VPN не ответила — состояние ссылок и трафик «всего» сейчас неизвестны.</p>
      )}
      {lastSnapshotAt ? (
        <p className="text-meta text-text-3">Устройства и трафик за 30 дней — на {formatDate(lastSnapshotAt, true)}.</p>
      ) : (
        data && (
          <p className="text-meta text-text-3">
            Число устройств и трафик за 30 дней появятся после первого снимка (раз в сутки, после 03:00 МСК). Точный список устройств — в карточке сотрудника.
          </p>
        )
      )}
      {error && <p className="text-meta text-status-overdue">{errorMessage(error)}</p>}
      {isLoading && <p className="text-ui text-text-3">Загрузка…</p>}

      {isMobile ? (
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-[16px] border border-border bg-surface">
          {rows.map((r) => (
            <button key={r.userId} onClick={() => setSelected(r.userId)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
              <div className="min-w-0">
                <p className="truncate text-[15px] text-foreground">{r.fullName}</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {STATE_LABELS[r.state]} · {r.state === "ACTIVE" ? `устройств ${devicesLabel(r)}` : devicesLabel(r)} · {traffic30Label(r.traffic30)}
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead label="ФИО" sortKey="name" sort={sort} desc={desc} onSort={handleSort} />
              <TableHead>Telegram ID</TableHead>
              <TableHead>Логин VPN</TableHead>
              <SortHead label="VPN" sortKey="state" sort={sort} desc={desc} onSort={handleSort} />
              <SortHead label="Устройства" sortKey="devices" sort={sort} desc={desc} onSort={handleSort} />
              <SortHead label="За 30 дней" sortKey="traffic30" sort={sort} desc={desc} onSort={handleSort} />
              <SortHead label="Всего" sortKey="trafficTotal" sort={sort} desc={desc} onSort={handleSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.userId} className="cursor-pointer" onClick={() => setSelected(r.userId)}>
                <TableCell>{r.fullName}</TableCell>
                <TableCell className="text-text-3">{r.telegramId}</TableCell>
                <TableCell className="text-text-3">{r.panelEmail ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={STATE_VARIANTS[r.state]}>{STATE_LABELS[r.state]}</Badge>
                </TableCell>
                <TableCell
                  className={r.state === "ACTIVE" && r.devices ? undefined : "text-text-3"}
                  title={r.state === "ACTIVE" && !r.devices ? DEVICES_PENDING_HINT : undefined}
                >
                  {devicesLabel(r)}
                </TableCell>
                <TableCell>{traffic30Label(r.traffic30)}</TableCell>
                <TableCell>{r.state === "ACTIVE" ? formatBytes(r.trafficTotal) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {isMobile ? (
        <BottomSheet open={selected !== null} onOpenChange={(v) => !v && setSelected(null)}>
          <BottomSheetContent className="px-4 pt-3 pb-6">
            <BottomSheetTitle className="sr-only">Карточка сотрудника</BottomSheetTitle>
            {card}
          </BottomSheetContent>
        </BottomSheet>
      ) : (
        <Dialog open={selected !== null} onOpenChange={(v) => !v && setSelected(null)}>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogTitle className="sr-only">Карточка сотрудника</DialogTitle>
            {card}
          </DialogContent>
        </Dialog>
      )}

      <AddEmployeeDialog open={addOpen} onClose={() => setAddOpen(false)} onAdded={setSelected} />
    </div>
  );
}
