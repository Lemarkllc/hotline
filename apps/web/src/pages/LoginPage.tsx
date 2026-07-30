import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Flame, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuthStore } from "@/lib/authStore";
import { ApiError } from "@/lib/apiClient";
import { useBeginTwoFactorSetup, useConfirmTwoFactorSetup, useLogin } from "@/hooks/api";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";

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
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [totpError, setTotpError] = useState<string | null>(null);
  const [setupData, setSetupData] = useState<{ secret: string; otpauthUrl: string } | null>(null);

  function backToCredentials() {
    setStep("credentials");
    setTotpCode("");
    setTotpError(null);
  }

  /** Первый шаг: только email+пароль. Требование 2FA — не ошибка, а следующий
   * ожидаемый шаг, поэтому переходит на отдельный экран без текста об ошибке. */
  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setCredentialsError(null);
    try {
      const result = await login.mutateAsync({ email, password });
      setTokens(result.accessToken, result.refreshToken);
      navigate(result.user.mustChangePassword ? "/change-password" : "/dashboard");
    } catch (err) {
      if (err instanceof ApiError && err.code === "TWO_FACTOR_SETUP_REQUIRED") {
        const data = await beginSetup.mutateAsync({ email, password });
        setSetupData(data);
        setStep("setup-2fa");
        return;
      }
      if (err instanceof ApiError && err.message.includes("Требуется код двухфакторной")) {
        setStep("totp");
        return;
      }
      setCredentialsError(err instanceof Error ? err.message : "Ошибка входа");
    }
  }

  async function handleTotp(e: React.FormEvent) {
    e.preventDefault();
    setTotpError(null);
    try {
      const result = await login.mutateAsync({ email, password, totpCode });
      setTokens(result.accessToken, result.refreshToken);
      navigate(result.user.mustChangePassword ? "/change-password" : "/dashboard");
    } catch (err) {
      setTotpError(err instanceof Error ? err.message : "Ошибка входа");
    }
  }

  async function handleConfirmSetup(e: React.FormEvent) {
    e.preventDefault();
    setTotpError(null);
    try {
      await confirmSetup.mutateAsync({ email, password, code: confirmCode });
      setSetupData(null);
      setStep("totp");
    } catch (err) {
      setTotpError(err instanceof Error ? err.message : "Не удалось подтвердить код");
    }
  }

  const isMobile = useIsMobile();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4">
      {isMobile && step === "credentials" && (
        <div className="mb-7 flex flex-col items-center gap-3">
          <div className="flex size-[76px] items-center justify-center rounded-[20px] bg-warning">
            <Flame className="size-[42px] text-white" />
          </div>
          <div className="text-center">
            <p className="text-2xl font-extrabold text-foreground">
              Hot<span className="text-warning">Line</span>
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">Панель обращений</p>
          </div>
        </div>
      )}
      <Card className={cn("w-full max-w-md", isMobile && "border-none bg-transparent shadow-none")}>
        {step === "credentials" && (
          <>
            {!isMobile && (
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flame className="size-5 text-amber-500" /> HotLine — вход
                </CardTitle>
              </CardHeader>
            )}
            <CardContent className={cn(isMobile && "p-0")}>
              <form onSubmit={handleCredentials} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  {!isMobile && <Label htmlFor="email">Email</Label>}
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder={isMobile ? "Email" : undefined}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={cn(isMobile && "h-[50px] rounded-[14px] text-[16px]")}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  {!isMobile && <Label htmlFor="password">Пароль</Label>}
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder={isMobile ? "Пароль" : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={cn(isMobile && "h-[50px] rounded-[14px] text-[16px]")}
                  />
                </div>
                {credentialsError && <p className="text-sm text-destructive">{credentialsError}</p>}
                <Button
                  type="submit"
                  disabled={login.isPending}
                  className={cn(isMobile && "h-[50px] rounded-[14px] text-[16px] font-semibold")}
                >
                  Войти
                </Button>
              </form>
            </CardContent>
          </>
        )}

        {step === "totp" && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="size-5 text-primary" /> Двухфакторная аутентификация
              </CardTitle>
              <CardDescription>
                Введите 6-значный код из приложения-аутентификатора для аккаунта <strong>{email}</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTotp} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="totp">Код из приложения</Label>
                  <Input
                    id="totp"
                    inputMode="numeric"
                    maxLength={6}
                    autoFocus
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    required
                    className={cn(isMobile && "h-[50px] rounded-[14px] text-[16px]")}
                  />
                </div>
                {totpError && <p className="text-sm text-destructive">{totpError}</p>}
                <Button type="submit" disabled={login.isPending || totpCode.length !== 6}>
                  Подтвердить
                </Button>
                <button
                  type="button"
                  onClick={backToCredentials}
                  className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="size-4" /> Назад к вводу пароля
                </button>
              </form>
            </CardContent>
          </>
        )}

        {step === "setup-2fa" && setupData && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="size-5 text-primary" /> Настройка двухфакторной аутентификации
              </CardTitle>
              <CardDescription>
                Для вашей роли 2FA обязательна. Добавьте аккаунт в приложении-аутентификаторе (Google
                Authenticator, Authy) — «Ввести код настройки вручную» — и вставьте секрет:
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleConfirmSetup} className="flex flex-col gap-4">
                <code className="break-all rounded-md bg-background p-3 text-sm">{setupData.secret}</code>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="confirmCode">Код из приложения</Label>
                  <Input
                    id="confirmCode"
                    inputMode="numeric"
                    maxLength={6}
                    autoFocus
                    value={confirmCode}
                    onChange={(e) => setConfirmCode(e.target.value)}
                    required
                    className={cn(isMobile && "h-[50px] rounded-[14px] text-[16px]")}
                  />
                </div>
                {totpError && <p className="text-sm text-destructive">{totpError}</p>}
                <Button type="submit" disabled={confirmSetup.isPending || confirmCode.length !== 6}>
                  Подтвердить и продолжить
                </Button>
                <button
                  type="button"
                  onClick={backToCredentials}
                  className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="size-4" /> Назад к вводу пароля
                </button>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
