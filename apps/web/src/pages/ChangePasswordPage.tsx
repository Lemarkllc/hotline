import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useChangePassword } from "@/hooks/api";
import { cn } from "@/lib/utils";

/** Четыре сегмента: длина, строчные+заглавные, цифра, спецсимвол — простая эвристика для
 * индикатора, не настоящая энтропия (Auth.dc.html "индикатор надёжности из четырёх
 * сегментов", сервер всё равно проверяет только минимальную длину). */
function passwordStrength(password: string): number {
  let score = 0;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  return score;
}

function StrengthMeter({ password }: { password: string }) {
  const score = passwordStrength(password);
  return (
    <div className="flex gap-1">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className={cn("h-[3px] flex-1 rounded-full bg-rule", i < score && "bg-status-closed")}
        />
      ))}
    </div>
  );
}

/** SRS §21: временный пароль требует смены при первом входе. */
export function ChangePasswordPage() {
  const navigate = useNavigate();
  const changePassword = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Ловим опечатку в новом пароле ДО запроса — реальный случай: пользователь
    // дважды вводил новый пароль вместо "текущий + новый", не заметив путаницы
    // до самого экрана логина.
    if (newPassword !== confirmPassword) {
      setError("Новый пароль и подтверждение не совпадают");
      return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сменить пароль");
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ground px-4">
      <div className="w-full max-w-[400px]">
        <h1 className="text-title font-bold text-text-1">Смена пароля</h1>
        <p className="mt-1 text-meta text-text-3">Ваш пароль временный — установите постоянный, прежде чем продолжить.</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="currentPassword">Текущий пароль (тот, что вводили при входе)</Label>
            {/* text-[16px] переопределяет базовый размер — iOS Safari сам зумит страницу
             * при фокусе на поле мельче 16px и не всегда возвращает зум обратно после
             * закрытия клавиатуры. */}
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="text-[16px]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newPassword">Новый пароль (не короче 12 символов)</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="text-[16px]"
            />
            {newPassword && <StrengthMeter password={newPassword} />}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">Подтвердите новый пароль</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              aria-invalid={mismatch}
              className="text-[16px]"
            />
            {mismatch && <p className="text-meta text-status-overdue">Пароли не совпадают</p>}
          </div>
          {error && <p className="text-meta text-status-overdue">{error}</p>}
          <Button type="submit" disabled={changePassword.isPending}>
            Сохранить и продолжить
          </Button>
          {/* На сервере mustChangePassword ничего не блокирует (soft-gate, см. CLAUDE.md) —
           * экран не должен быть тупиком без явного выхода. */}
          <Button type="button" variant="ghost" onClick={() => navigate("/dashboard")}>
            Позже
          </Button>
        </form>
      </div>
    </div>
  );
}
