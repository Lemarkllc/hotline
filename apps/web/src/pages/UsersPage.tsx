import { useState } from "react";
import { CHANNELS, ROLE_NAMES, USER_STATUS_LABELS, type Channel, type UserStatus } from "@hotline/shared";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

function CreateWebAccountDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("MANAGER");
  const create = useCreateWebAccount();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await create.mutateAsync({ email, fullName, roleNames: [role] });
    setOpen(false);
    setEmail("");
    setFullName("");
    if (result.emailSent) {
      window.alert(`Веб-аккаунт создан. Временный пароль отправлен на ${email}.`);
    } else {
      window.alert(
        `Веб-аккаунт создан, но письмо не отправилось (нет связи с почтой). Временный пароль для ${fullName}: ${result.temporaryPassword}`,
      );
    }
  }

  return (
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
            <select
              id="role"
              className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {ROLE_NAMES.filter((r) => r !== "EMPLOYEE").map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              Создать
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** SRS §4.5 "Управлять ролями": раньше роль/ФИО/привязку Telegram можно было задать
 * только один раз при создании веб-аккаунта — теперь Администратор может их поправить. */
function EditUserDialog({ user }: { user: UserDTO }) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(user.fullName);
  const [telegramId, setTelegramId] = useState(user.telegramId ?? "");
  const [role, setRole] = useState(user.roleNames?.[0] ?? "MANAGER");
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
            <select
              id="editRole"
              className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {ROLE_NAMES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Доступ к каналам</Label>
            <p className="text-xs text-muted-foreground">
              Определяет, чьи обращения видит пользователь — не то же самое, что роль.
            </p>
            {CHANNELS.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Пользователи</h1>
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
              <TableCell className="text-muted-foreground">{u.email ?? u.telegramId}</TableCell>
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
                        window.alert(
                          result.emailSent
                            ? `Временный пароль отправлен на ${u.email}.`
                            : `Письмо не отправилось (нет связи с почтой). Временный пароль для ${u.fullName}: ${result.temporaryPassword}`,
                        );
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
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={unblock.isPending}
                      onClick={() => {
                        if (window.confirm(`Разблокировать ${u.fullName}?`)) unblock.mutate(u.id);
                      }}
                    >
                      Разблокировать
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

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
