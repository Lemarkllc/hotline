import { useState } from "react";
import { ROLE_NAMES, USER_STATUS_LABELS, type UserStatus } from "@hotline/shared";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  useAccessRequests,
  useApproveAccessRequest,
  useBlockUser,
  useCreateWebAccount,
  useRejectAccessRequest,
  useUsers,
} from "@/hooks/api";

function CreateWebAccountDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("MANAGER");
  const create = useCreateWebAccount();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({ email, fullName, temporaryPassword: password, roleNames: [role] });
    setOpen(false);
    setEmail("");
    setFullName("");
    setPassword("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Новый веб-аккаунт</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Новый веб-аккаунт</DialogTitle>
        <DialogDescription>Регистрация в веб-панели отдельная от бота (SRS §4.1) — заводит Администратор.</DialogDescription>
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
          <div className="flex flex-col gap-1">
            <Label htmlFor="password">Временный пароль (мин. 12 символов)</Label>
            <Input id="password" minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} required />
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

export function UsersPage() {
  const { data: requests } = useAccessRequests();
  const { data: users } = useUsers();
  const approve = useApproveAccessRequest();
  const reject = useRejectAccessRequest();
  const block = useBlockUser();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Пользователи</h1>
        <CreateWebAccountDialog />
      </div>

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
                {u.status === "ACTIVE" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const reason = window.prompt("Причина блокировки:");
                      if (reason) block.mutate({ id: u.id, reason });
                    }}
                  >
                    Заблокировать
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
