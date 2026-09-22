import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Copy, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Публичная страница-прокладка для кнопки «Получить VPN» в боте (без RequireAuth —
 * открывается прямо из Telegram, у посетителя нет сессии Lemark One). Решает
 * ограничение Bot API: inline-кнопка с url не даёт произвольную схему (happ://,
 * incy://) — sendMessage падал с "Unsupported URL protocol" (найдено вживую,
 * 2026-09-22). Кнопка в боте ведёт сюда (https, проходит проверку Telegram), а
 * обычный тап по <a href="happ://..."> с уже загруженной веб-страницы — тот же
 * механизм, что подтверждён вживую на ссылке Bitrix в этой сессии — открывает
 * приложение. Формат диплинка (<scheme>://add/<ссылка>) не подтверждён официальной
 * документацией Happ/Incy — лучшее предположение, ссылка на канал предполагаемого
 * поставщика подтверждает как минимум сам паттерн "своя https-страница → диплинк".
 */
export function VpnConnectPage() {
  const [params] = useSearchParams();
  const subscriptionUrl = params.get("url");
  const [copied, setCopied] = useState(false);

  if (!subscriptionUrl) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-ground px-4 text-center">
        <p className="text-ui font-medium text-text-1">Ссылка повреждена</p>
        <p className="max-w-sm text-meta text-text-3">Запросите VPN-доступ заново командой /vpn в боте.</p>
      </div>
    );
  }

  const encoded = encodeURIComponent(subscriptionUrl);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-ground px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-lg border border-rule bg-surface p-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <ShieldCheck className="size-8 text-action" />
          <h1 className="text-title font-bold text-text-1">Подключение VPN</h1>
          <p className="text-meta text-text-3">Выберите приложение — ссылка на подписку вставится автоматически.</p>
        </div>

        <div className="flex flex-col gap-2.5">
          <Button asChild size="lg">
            <a href={`happ://add/${encoded}`}>Открыть в Happ</a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={`incy://add/${encoded}`}>Открыть в Incy</a>
          </Button>
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
