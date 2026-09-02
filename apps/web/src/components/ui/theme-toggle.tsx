import { Moon, Sun } from "lucide-react";
import { useThemeStore } from "@/lib/themeStore";
import { cn } from "@/lib/utils";

/** Единый переключатель темы — используется и в десктопном Topbar, и в мобильном
 * "Профиль" (design_handoff_lemark_one не рисовал тумблер темы отдельным компонентом,
 * поэтому анатомия — обычный переключатель track+thumb, а не что-то из хендоффа).
 * Иконка внутри "ползунка" отражает ТЕКУЩУЮ активную тему (не следующую) — солнце
 * видно при светлой теме, луна — при тёмной, ползунок физически едет влево/вправо. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  // "system" переключается в конкретную тему по одному клику (не в трёхпозиционный
  // цикл) — большинству достаточно двух состояний, а "вернуться к системной" по
  // запросу через отдельный пункт не заводим, пока никто не попросил.
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Включена тёмная тема — нажмите для светлой" : "Включена светлая тема — нажмите для тёмной"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn("flex size-touch shrink-0 items-center justify-center", className)}
    >
      <span className="relative inline-flex h-6 w-11 items-center rounded-full border border-rule-strong bg-surface-sunk">
        <span
          className={cn(
            "flex size-[18px] items-center justify-center rounded-full bg-surface shadow-1 transition-transform duration-2",
            isDark ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        >
          {isDark ? <Moon className="size-3 text-text-1" /> : <Sun className="size-3 text-status-review" />}
        </span>
      </span>
    </button>
  );
}
