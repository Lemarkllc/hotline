import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuthStore } from "@/lib/authStore";
import { ApiError } from "@/lib/apiClient";
import { useBeginTwoFactorSetup, useConfirmTwoFactorSetup, useLogin } from "@/hooks/api";

type Step = "credentials" | "totp" | "setup-2fa";

export function LoginPage() {
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const login = useLogin();
  const beginSetup = useBeginTwoFactorSetup();
  const confirmSetup = useConfirmTwoFactorSetup();

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [setupData, setSetupData] = useState<{ secret: string; otpauthUrl: string } | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await login.mutateAsync({ email, password, totpCode: totpCode || undefined });
      setTokens(result.accessToken, result.refreshToken);
      navigate(result.user.mustChangePassword ? "/change-password" : "/dashboard");
    } catch (err) {
      if (err instanceof ApiError && err.code === "TWO_FACTOR_SETUP_REQUIRED") {
        const data = await beginSetup.mutateAsync({ email, password });
        setSetupData(data);
        setStep("setup-2fa");
        return;
      }
      if (err instanceof ApiError && err.message.includes("код двухфакторной")) {
        setStep("totp");
      }
      setError(err instanceof Error ? err.message : "Ошибка входа");
    }
  }

  async function handleConfirmSetup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await confirmSetup.mutateAsync({ email, password, code: confirmCode });
      setStep("totp");
      setSetupData(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось подтвердить код");
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" /> HotLineBot — вход
          </CardTitle>
          <CardDescription>Внутренняя система обратной связи. Доступ только для сотрудников с назначенной ролью.</CardDescription>
        </CardHeader>
        <CardContent>
          {step === "setup-2fa" && setupData ? (
            <form onSubmit={handleConfirmSetup} className="flex flex-col gap-4">
              <p className="text-sm">
                Для вашей роли обязательна двухфакторная аутентификация. Отсканируйте секрет в приложении
                (Google Authenticator, Authy) или введите его вручную:
              </p>
              <code className="break-all rounded-md bg-background p-3 text-sm">{setupData.secret}</code>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirmCode">Код из приложения</Label>
                <Input
                  id="confirmCode"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={confirmSetup.isPending}>
                Подтвердить и продолжить
              </Button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {step === "totp" && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="totp">Код двухфакторной аутентификации</Label>
                  <Input
                    id="totp"
                    inputMode="numeric"
                    maxLength={6}
                    autoFocus
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                  />
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={login.isPending}>
                Войти
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
