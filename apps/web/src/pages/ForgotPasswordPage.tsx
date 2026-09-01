import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/useIsMobile";

/** Спроектировано сверх текущего кода (design_handoff_lemark_one/README.md "Восстановление
 * пароля") — эндпоинта самообслуживания нет и не планируется: пароли сбрасывает
 * администратор. Экран честно называет это заявкой администратору, а не письмом со ссылкой —
 * никакой формы, отправляющей запрос в никуда. */
export function ForgotPasswordPage() {
  const isMobile = useIsMobile();

  return (
    <div className={isMobile ? "flex min-h-dvh flex-col justify-center bg-ground px-5" : "flex min-h-dvh items-center justify-center bg-ground px-4"}>
      <div className="w-full max-w-[400px]">
        <Link to="/login" className="mb-6 flex items-center gap-1.5 text-meta text-text-3 hover:text-text-1">
          <ArrowLeft className="size-4" /> Назад к входу
        </Link>
        <h1 className="text-title font-bold text-text-1">Восстановление пароля</h1>
        <p className="mt-2 text-ui text-text-2">
          В Lemark One нет самостоятельного сброса пароля по ссылке — временный пароль выдаёт
          администратор.
        </p>
        <div className="mt-6 flex flex-col gap-3 rounded-md border border-status-closed/35 bg-status-closed-tint p-4">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-status-closed" />
            <p className="text-ui text-text-1">
              Обратитесь к администратору лично или по внутренним каналам компании и назовите свой
              email. Он выдаст временный пароль — при следующем входе система попросит его сменить.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
