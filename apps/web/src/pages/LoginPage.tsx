import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Check, Copy } from "lucide-react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OtpInput } from "@/components/ui/otp-input";
import { useAuthStore } from "@/lib/authStore";
import { ApiError } from "@/lib/apiClient";
import { useBeginTwoFactorSetup, useConfirmTwoFactorSetup, useLogin } from "@/hooks/api";
import { useIsMobile } from "@/hooks/useIsMobile";

type Step = "credentials" | "totp" | "setup-2fa";

function ErrorBanner({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="rounded-md border border-status-overdue/35 bg-status-overdue-tint px-3 py-2.5">
      <p className="text-ui font-medium text-status-overdue">{title}</p>
      {detail && <p className="mt-0.5 text-meta text-text-2">{detail}</p>}
    </div>
  );
}

function QrCode({ otpauthUrl }: { otpauthUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current) void QRCode.toCanvas(canvasRef.current, otpauthUrl, { width: 132, margin: 1 });
  }, [otpauthUrl]);
  return (
    <div className="flex size-[132px] shrink-0 items-center justify-center rounded-md border border-rule bg-surface p-2">
      <canvas ref={canvasRef} className="size-full" />
    </div>
  );
}

function SecretBlock({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false);
  const chunks = secret.match(/.{1,4}/g)?.join(" ") ?? secret;
  return (
    <div className="flex flex-1 flex-col gap-2">
      <code className="break-all rounded-md bg-surface-sunk px-3 py-2 font-mono text-meta text-text-1">{chunks}</code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          void navigator.clipboard.writeText(secret);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Скопировано" : "Скопировать секрет"}
      </Button>
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const login = useLogin();
  const beginSetup = useBeginTwoFactorSetup();
  const confirmSetup = useConfirmTwoFactorSetup();
  const isMobile = useIsMobile();

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

  async function handleTotp(code?: string) {
    setTotpError(null);
    try {
      const result = await login.mutateAsync({ email, password, totpCode: code ?? totpCode });
      setTokens(result.accessToken, result.refreshToken);
      navigate(result.user.mustChangePassword ? "/change-password" : "/dashboard");
    } catch (err) {
      setTotpError(err instanceof Error ? err.message : "Ошибка входа");
    }
  }

  async function handleConfirmSetup(code?: string) {
    setTotpError(null);
    try {
      await confirmSetup.mutateAsync({ email, password, code: code ?? confirmCode });
      setSetupData(null);
      setStep("totp");
    } catch (err) {
      setTotpError(err instanceof Error ? err.message : "Не удалось подтвердить код");
    }
  }

  if (isMobile) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-ground px-4">
        {step === "credentials" && (
          <div className="mb-8 text-center">
            <p className="text-[26px] font-bold tracking-[-0.02em] text-text-1">
              Lemark<span className="text-brand">·</span> <span className="font-light text-text-2">One</span>
            </p>
            <p className="mt-1 text-meta text-text-3">Единая система взаимодействия</p>
          </div>
        )}
        <div className="w-full max-w-md">
          {step === "credentials" && (
            <form onSubmit={handleCredentials} className="flex flex-col gap-4">
              <Input
                type="email"
                autoComplete="username"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-touch rounded-lg text-[16px]"
                aria-invalid={Boolean(credentialsError)}
              />
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-touch rounded-lg text-[16px]"
                aria-invalid={Boolean(credentialsError)}
              />
              <Link to="/forgot-password" className="self-end text-meta text-text-3 hover:text-text-1">
                Забыли пароль?
              </Link>
              {credentialsError && <ErrorBanner title="Не удалось войти" detail={credentialsError} />}
              <Button type="submit" disabled={login.isPending} className="h-touch rounded-lg text-[16px] font-semibold">
                Войти
              </Button>
            </form>
          )}
          {step === "totp" && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-head font-semibold text-text-1">Код из приложения</p>
              <OtpInput value={totpCode} onChange={setTotpCode} onComplete={handleTotp} error={Boolean(totpError)} autoFocus />
              {totpError && <ErrorBanner title="Неверный код" detail={totpError} />}
              <button type="button" onClick={backToCredentials} className="flex items-center gap-1 text-meta text-text-3">
                <ArrowLeft className="size-4" /> Назад
              </button>
            </div>
          )}
          {step === "setup-2fa" && setupData && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-head font-semibold text-text-1">Настройка 2FA</p>
              <QrCode otpauthUrl={setupData.otpauthUrl} />
              <SecretBlock secret={setupData.secret} />
              <OtpInput value={confirmCode} onChange={setConfirmCode} onComplete={handleConfirmSetup} error={Boolean(totpError)} autoFocus />
              {totpError && <ErrorBanner title="Не удалось подтвердить" detail={totpError} />}
              <button type="button" onClick={backToCredentials} className="flex items-center gap-1 text-meta text-text-3">
                <ArrowLeft className="size-4" /> Назад
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh">
      {/* Левая бренд-панель — 520px, три пояса. Без маркетингового текста: часть модулей
       * ещё не существует, экран входа не место для их перечисления (design_handoff_lemark_one/README.md). */}
      <div className="flex w-[520px] shrink-0 flex-col justify-between border-r border-rule bg-surface p-12">
        <p className="text-[15px] font-medium text-text-2">Lemark One</p>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-[88px] font-bold leading-[.82] tracking-[-.045em] text-text-1">Lemark</span>
            <span className="mb-3 size-4 rounded-full bg-brand" />
          </div>
          <div className="flex items-baseline gap-4">
            <span className="text-[88px] font-light leading-[.82] text-text-2">One</span>
            <span className="h-px flex-1 bg-rule" />
          </div>
        </div>
        <p className="font-mono text-[11px] tracking-[.06em] text-text-3">ЕДИНАЯ СИСТЕМА ВЗАИМОДЕЙСТВИЯ</p>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-[400px]">
          {step === "credentials" && (
            <form onSubmit={handleCredentials} className="flex flex-col gap-4">
              <div>
                <h1 className="text-title font-bold text-text-1">Вход</h1>
                <p className="mt-1 text-meta text-text-3">Войдите с учётными данными Lemark One</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  aria-invalid={Boolean(credentialsError)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Пароль</Label>
                  <Link to="/forgot-password" className="text-meta text-text-3 hover:text-text-1">
                    Забыли пароль?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  aria-invalid={Boolean(credentialsError)}
                />
              </div>
              {credentialsError && <ErrorBanner title="Не удалось войти" detail={credentialsError} />}
              <Button type="submit" disabled={login.isPending}>
                {login.isPending ? "Проверяем…" : "Войти"}
              </Button>
            </form>
          )}

          {step === "totp" && (
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="text-title font-bold text-text-1">Двухфакторная аутентификация</h1>
                <p className="mt-1 text-meta text-text-3">
                  Введите 6-значный код из приложения-аутентификатора для <strong className="text-text-1">{email}</strong>.
                </p>
              </div>
              <OtpInput value={totpCode} onChange={setTotpCode} onComplete={handleTotp} error={Boolean(totpError)} autoFocus />
              {totpError && (
                <ErrorBanner
                  title="Неверный код"
                  detail={`${totpError.replace(/[.\s]*$/, "")}. Код живёт 30 секунд — проверьте текущий.`}
                />
              )}
              <Button disabled={login.isPending || totpCode.length !== 6} onClick={() => void handleTotp()}>
                Подтвердить
              </Button>
              <p className="text-meta text-text-3">
                Нет доступа к аутентификатору? Сброс 2FA делает администратор — обратитесь к нему.
              </p>
              <button
                type="button"
                onClick={backToCredentials}
                className="flex items-center justify-center gap-1 text-meta text-text-3 hover:text-text-1"
              >
                <ArrowLeft className="size-4" /> Назад к вводу пароля
              </button>
            </div>
          )}

          {step === "setup-2fa" && setupData && (
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="text-title font-bold text-text-1">Настройка двухфакторной аутентификации</h1>
                <p className="mt-1 text-meta text-text-3">
                  Для вашей роли 2FA обязательна. Отсканируйте QR в приложении-аутентификаторе (Google
                  Authenticator, Authy) или введите секрет вручную.
                </p>
              </div>
              <div className="flex gap-4">
                <QrCode otpauthUrl={setupData.otpauthUrl} />
                <SecretBlock secret={setupData.secret} />
              </div>
              <div className="rounded-md border border-status-review/35 bg-status-review-tint px-3 py-2.5 text-meta text-text-2">
                Сохраните секрет — восстановить доступ без него сможет только администратор.
              </div>
              <OtpInput
                value={confirmCode}
                onChange={setConfirmCode}
                onComplete={handleConfirmSetup}
                error={Boolean(totpError)}
                autoFocus
              />
              {totpError && <ErrorBanner title="Не удалось подтвердить" detail={totpError} />}
              <Button disabled={confirmSetup.isPending || confirmCode.length !== 6} onClick={() => void handleConfirmSetup()}>
                Подтвердить и продолжить
              </Button>
              <button
                type="button"
                onClick={backToCredentials}
                className="flex items-center justify-center gap-1 text-meta text-text-3 hover:text-text-1"
              >
                <ArrowLeft className="size-4" /> Назад к вводу пароля
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
