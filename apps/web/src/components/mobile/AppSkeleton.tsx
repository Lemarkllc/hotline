/** Скелетон между статическим сплэшем (index.html) и реальным приложением — держится,
 * пока useMe() тянет пользователя/права после логина (см. App.tsx). Форма повторяет
 * реальный каркас мобильного лэйаута (шапка + сетка карточек + bottom tab bar), чтобы
 * переход в настоящий контент не дёргался сменой структуры, только сменой заливки на
 * реальные данные. */
export function AppSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="flex-1 px-4 pb-20 pt-[calc(env(safe-area-inset-top)+16px)]">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <div className="h-5 w-40 animate-pulse rounded-full bg-border" />
            <div className="h-3 w-24 animate-pulse rounded-full bg-border" />
          </div>
          <div className="size-10 shrink-0 animate-pulse rounded-full bg-border" />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[86px] animate-pulse rounded-[16px] border border-border bg-surface" />
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[70px] animate-pulse rounded-[14px] border border-border bg-surface" />
          ))}
        </div>
      </div>

      <div className="flex h-[72px] shrink-0 items-center justify-around border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="size-6 animate-pulse rounded-md bg-border" />
        ))}
      </div>
    </div>
  );
}
