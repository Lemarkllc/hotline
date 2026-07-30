import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useChangePassword } from "@/hooks/api";

/** SRS §21: временный пароль требует смены при первом входе. */
export function ChangePasswordPage() {
  const navigate = useNavigate();
  const changePassword = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сменить пароль");
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4">
      {/* Смена пароля не обязательна прямо сейчас (soft-gate, см. CLAUDE.md — mustChangePassword
       * ничего не блокирует на сервере), поэтому явный выход нужен: без него страница вне AppShell
       * (ни Sidebar, ни bottom tab bar) была тупиком — ни назад, ни в сторону. */}
      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Назад
        </button>
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Смена пароля</CardTitle>
          <CardDescription>Ваш пароль временный — установите постоянный, прежде чем продолжить.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="currentPassword">Текущий пароль</Label>
              {/* text-[16px] переопределяет базовый text-sm (14px) — iOS Safari сам зумит
               * страницу при фокусе на поле мельче 16px и не всегда возвращает зум обратно
               * после закрытия клавиатуры. */}
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="text-[16px]"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="newPassword">Новый пароль (не короче 12 символов)</Label>
              <Input
                id="newPassword"
                type="password"
                minLength={12}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="text-[16px]"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={changePassword.isPending}>
              Сохранить и продолжить
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
