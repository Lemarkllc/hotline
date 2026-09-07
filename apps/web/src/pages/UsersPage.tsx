import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { CHANNELS, ROLE_NAMES, USER_STATUS_LABELS, type Channel, type UserStatus } from "@hotline/shared";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AccessRequestsCard } from "@/components/users/AccessRequestsCard";
import { ReasonDialog } from "@/components/ui/reason-dialog";
import {
  useBlockUser,
  useCreateWebAccount,
  useResetPassword,
  useUnblockUser,
  useUpdateUser,
  useUpdateUserChannels,
  useUsers,
  type UserDTO,
} from "@/hooks/api";

const CHANNEL_LABELS: Record<Channel, string> = {
  EMPLOYEE: "Сотрудники (обращения от персонала)",
  CUSTOMER: "Клиенты (Продажи)",
};

interface TempPasswordResult {
  emailSent: boolean;
  email?: string;
  fullName: string;
  temporaryPassword?: string;
}

/** Замена window.alert() с паролем внутри — системный диалог не стилизуется и
 * показывает секрет в самый чувствительный момент (найдено QA-аудитом). Тот же
 * паттерн "код + кнопка копировать", что и SecretBlock на LoginPage.tsx (там —
 * TOTP-секрет, здесь — временный пароль, оба существуют только пока их не скопируют). */
function TempPasswordDialog({ result, onClose }: { result: TempPasswordResult | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  return (
    <Dialog open={result !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogTitle>{result?.emailSent ? "Письмо отправлено" : "Письмо не отправилось"}</DialogTitle>
        <DialogDescription>
          {result?.emailSent
            ? `Временный пароль отправлен на ${result.email}.`
            : `Нет связи с почтой — передайте временный пароль ${result?.fullName} вручную.`}
        </DialogDescription>
        {!result?.emailSent && result?.temporaryPassword && (
          <div className="mt-4 flex items-center gap-2">
            <code className="flex-1 break-all rounded-md bg-surface-sunk px-3 py-2 font-mono text-meta text-text-1">
              {result.temporaryPassword}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(result.temporaryPassword ?? "");
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
        )}
        <DialogFooter>
          <Button onClick={onClose}>Готово</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Замена window.confirm() — блокирует автоматизацию/тестирование и не
 * стилизуется (найдено QA-аудитом). Простое да/нет-подтверждение без сбора
 * текста — ReasonDialog для этого избыточен (у него обязательное поле причины). */
function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = "Подтвердить",
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отменить
          </Button>
          <Button disabled={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateWebAccountDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  // EMPLOYEE — самый безопасный дефолт (у роли нет ни одного permission, см.
  // DEFAULT_ROLE_PERMISSIONS в packages/shared/permissions.ts): если Администратор
  // невнимательно проскочит выбор роли при создании аккаунта, новый пользователь
  // просто ничего не увидит в панели, а не получит доступ к обращениям (был MANAGER —
  // реальный риск случайно выдать лишний доступ, найдено пользователем вживую).
  const [role, setRole] = useState("EMPLOYEE");
  const [result, setResult] = useState<TempPasswordResult | null>(null);
  const create = useCreateWebAccount();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const created = await create.mutateAsync({ email, fullName, roleNames: [role] });
    setOpen(false);
    setResult({ emailSent: created.emailSent, email, fullName, temporaryPassword: created.temporaryPassword });
    setEmail("");
    setFullName("");
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>Новый веб-аккаунт</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Новый веб-аккаунт</DialogTitle>
          <DialogDescription>
            Регистрация в веб-панели отдельная от бота (SRS §4.1) — заводит Администратор. Временный пароль
            сгенерируется автоматически и уйдёт письмом на указанный email.
          </DialogDescription>
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="fullName">ФИО</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="role">Роль</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_NAMES.filter((r) => r !== "EMPLOYEE").map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                Создать
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <TempPasswordDialog result={result} onClose={() => setResult(null)} />
    </>
  );
}

/** SRS §4.5 "Управлять ролями": раньше роль/ФИО/привязку Telegram можно было задать
 * только один раз при создании веб-аккаунта — теперь Администратор может их поправить. */
function EditUserDialog({ user }: { user: UserDTO }) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(user.fullName);
  const [telegramId, setTelegramId] = useState(user.telegramId ?? "");
  // Тот же безопасный дефолт, что и в CreateWebAccountDialog — этот fallback
  // сработает только если у существующего пользователя вообще нет роли (не должно
  // случаться в норме), но лучше молча не подставлять MANAGER и в этом крайнем случае.
  const [role, setRole] = useState(user.roleNames?.[0] ?? "EMPLOYEE");
  const [channels, setChannels] = useState<Channel[]>(user.channels ?? []);
  const update = useUpdateUser();
  const updateChannels = useUpdateUserChannels();

  function toggleChannel(channel: Channel) {
    setChannels((prev) => (prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({
      id: user.id,
      fullName,
      telegramId: telegramId.trim() ? telegramId.trim() : null,
      roleNames: [role],
    });
    // Отдельный запрос от роли/ФИО намеренно — свой эндпоинт (PATCH /users/:id/channels,
    // см. PLAN.md "Найден и закрыт пробел 10.08.2026"), своя семантика "полная замена
    // набора", роль сама по себе канал больше не определяет молча.
    await updateChannels.mutateAsync({ id: user.id, channels });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Изменить
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Изменить пользователя</DialogTitle>
        <DialogDescription>ФИО, привязка Telegram-аккаунта и роль.</DialogDescription>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="editFullName">ФИО</Label>
            <Input id="editFullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="editTelegramId">Telegram ID</Label>
            <Input
              id="editTelegramId"
              value={telegramId}
              onChange={(e) => setTelegramId(e.target.value)}
              placeholder="не привязан"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="editRole">Роль</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="editRole">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_NAMES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Доступ к каналам</Label>
            <p className="text-meta text-text-3">
              Определяет, чьи обращения видит пользователь — не то же самое, что роль.
            </p>
            {CHANNELS.map((c) => (
              <label key={c} className="flex items-center gap-2 text-ui text-text-1">
                <input type="checkbox" checked={channels.includes(c)} onChange={() => toggleChannel(c)} />
                {CHANNEL_LABELS[c]}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={update.isPending || updateChannels.isPending}>
              Сохранить
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UsersPage() {
  const { data: users } = useUsers();
  const block = useBlockUser();
  const unblock = useUnblockUser();
  const resetPassword = useResetPassword();
  const [blockTarget, setBlockTarget] = useState<UserDTO | null>(null);
  const [unblockTarget, setUnblockTarget] = useState<UserDTO | null>(null);
  const [resetResult, setResetResult] = useState<TempPasswordResult | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-title font-bold text-text-1">Пользователи</h1>
        <CreateWebAccountDialog />
      </div>

      <AccessRequestsCard />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ФИО</TableHead>
            <TableHead>Email / Telegram</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users?.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.fullName}</TableCell>
              <TableCell className="text-text-3">{u.email ?? u.telegramId}</TableCell>
              <TableCell>
                <Badge variant={u.status === "ACTIVE" ? "success" : u.status === "BLOCKED" ? "destructive" : "outline"}>
                  {USER_STATUS_LABELS[u.status as UserStatus] ?? u.status}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <EditUserDialog user={u} />
                  {u.email && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={resetPassword.isPending}
                      onClick={async () => {
                        const result = await resetPassword.mutateAsync(u.id);
                        setResetResult({
                          emailSent: result.emailSent,
                          email: u.email ?? undefined,
                          fullName: u.fullName,
                          temporaryPassword: result.temporaryPassword,
                        });
                      }}
                    >
                      Сбросить пароль
                    </Button>
                  )}
                  {u.status === "ACTIVE" && (
                    <Button size="sm" variant="outline" onClick={() => setBlockTarget(u)}>
                      Заблокировать
                    </Button>
                  )}
                  {u.status === "BLOCKED" && (
                    <Button size="sm" variant="outline" onClick={() => setUnblockTarget(u)}>
                      Разблокировать
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <TempPasswordDialog result={resetResult} onClose={() => setResetResult(null)} />

      <ConfirmDialog
        open={unblockTarget !== null}
        onClose={() => setUnblockTarget(null)}
        title="Разблокировать пользователя"
        description={unblockTarget ? `Разблокировать ${unblockTarget.fullName}?` : ""}
        confirmLabel="Разблокировать"
        pending={unblock.isPending}
        onConfirm={() => {
          if (!unblockTarget) return;
          unblock.mutate(unblockTarget.id);
          setUnblockTarget(null);
        }}
      />

      <ReasonDialog
        open={blockTarget !== null}
        onClose={() => setBlockTarget(null)}
        title={blockTarget ? `Заблокировать ${blockTarget.fullName}` : "Заблокировать"}
        description="Причина обязательна и будет видна в истории аудита."
        placeholder="Причина блокировки…"
        confirmLabel="Заблокировать"
        required
        pending={block.isPending}
        onConfirm={async (reason) => {
          if (!blockTarget || !reason) return;
          await block.mutateAsync({ id: blockTarget.id, reason });
          setBlockTarget(null);
        }}
      />
    </div>
  );
}
