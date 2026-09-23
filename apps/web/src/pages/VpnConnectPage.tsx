import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Copy, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type AppKey = "happ" | "v2raytun" | "incy";

const APP_LABELS: Record<AppKey, string> = { happ: "Happ", v2raytun: "V2rayTun", incy: "INCY" };

/** Форматы диплинков — подтверждены рабочей реализацией стороннего провайдера
 * (connect.php, изучено 2026-09-23), а не собственным предположением, как в первой
 * версии этой страницы. Важная деталь: Happ и INCY НЕ кодируют саму ссылку-подписку
 * (`happ://add/https://...`, не `happ://add/https%3A%2F%2F...`), кодирует только
 * V2rayTun (`v2raytun://import/<urlencode>`). */
function buildDeepLink(app: AppKey, subscriptionUrl: string): string {
  switch (app) {
    case "happ":
      return `happ://add/${subscriptionUrl}`;
    case "incy":
      return `incy://import/${subscriptionUrl}`;
    case "v2raytun":
      return `v2raytun://import/${encodeURIComponent(subscriptionUrl)}`;
  }
}

/** Порядок попыток — Happ всегда первым (решение пользователя 2026-09-23, это
 * основное приложение компании), на Android/iOS следом V2rayTun и INCY как
 * запасные варианты, на остальных — только Happ. */
function detectAttemptOrder(): AppKey[] {
  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  return isAndroid || isIOS ? ["happ", "v2raytun", "incy"] : ["happ"];
}

/**
 * Публичная страница-прокладка для кнопки «Получить VPN» в боте (без RequireAuth —
 * открывается прямо из Telegram, у посетителя нет сессии Lemark One). Решает
 * ограничение Bot API: inline-кнопка с url не даёт произвольную схему (happ://,
 * incy://) — sendMessage падал с "Unsupported URL protocol" (найдено вживую,
 * 2026-09-22). Кнопка в боте ведёт сюда (https, проходит проверку Telegram), а уже
 * отсюда — автоматический перебор диплинков по очереди (тот же принцип, что
 * подтверждён вживую на ссылке Bitrix в этой сессии: тап/переход с настоящей
 * веб-страницы триггерит диплинк надёжно, в отличие от кнопки самого Telegram).
 */
export function VpnConnectPage() {
  const [params] = useSearchParams();
  const subscriptionUrl = params.get("url");
  const [copied, setCopied] = useState(false);

  const attempts = useMemo(() => {
    if (!subscriptionUrl) return [];
    const seen = new Set<string>();
    const result: { app: AppKey; url: string }[] = [];
    for (const app of detectAttemptOrder()) {
      const url = buildDeepLink(app, subscriptionUrl);
      if (seen.has(url)) continue;
      seen.add(url);
      result.push({ app, url });
    }
    return result;
  }, [subscriptionUrl]);

  // Автоматический перебор — 0/1400/2800мс, останавливается, как только страница
  // скрылась (значит приложение открылось): тот же тайминг и признак успеха, что
  // и в проверенной сторонней реализации (connect.php).
  useEffect(() => {
    if (attempts.length === 0) return;
    let opened = false;
    const markOpened = () => {
      opened = true;
    };
    const onVisibility = () => {
      if (document.hidden) markOpened();
    };
    const onBlur = () => {
      setTimeout(() => {
        if (document.hidden) markOpened();
      }, 100);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", markOpened);
    window.addEventListener("blur", onBlur);

    const timers = attempts.map((attempt, index) =>
      window.setTimeout(() => {
        if (!opened) window.location.href = attempt.url;
      }, index * 1400),
    );

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", markOpened);
      window.removeEventListener("blur", onBlur);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [attempts]);

  if (!subscriptionUrl) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-ground px-4 text-center">
        <p className="text-ui font-medium text-text-1">Ссылка повреждена</p>
        <p className="max-w-sm text-meta text-text-3">Запросите VPN-доступ заново командой /vpn в боте.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-ground px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-lg border border-rule bg-surface p-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <ShieldCheck className="size-8 text-action" />
          <h1 className="text-title font-bold text-text-1">Подключение VPN</h1>
          <p className="text-meta text-text-3">
            Открываем приложение автоматически — порядок: {attempts.map((a) => APP_LABELS[a.app]).join(" → ")}.
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          {attempts.map((attempt) => (
            <Button key={attempt.app} asChild size="lg" variant={attempt === attempts[0] ? "default" : "outline"}>
              <a href={attempt.url}>Открыть в {APP_LABELS[attempt.app]}</a>
            </Button>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-rule pt-4">
          <p className="text-meta text-text-3">Не открылось само — скопируйте ссылку и вставьте в приложении вручную (кнопка «+»):</p>
          <code className="break-all rounded-md bg-surface-sunk px-3 py-2 font-mono text-meta text-text-1">
            {subscriptionUrl}
          </code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(subscriptionUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Скопировано" : "Скопировать ссылку"}
          </Button>
        </div>
      </div>
    </div>
  );
}
