import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

/** Ключ "lemark-theme" синхронизирован с инлайн-скриптом в index.html — тот
 * применяет класс на <html> ДО первой отрисовки (без него тёмная системная тема
 * мигала бы светлым сплэшем на долю секунды, см. index.html). */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (theme) => set({ theme }),
    }),
    { name: "lemark-theme" },
  ),
);

function resolveDark(theme: Theme): boolean {
  return theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

/** Держит класс .dark/.light на <html> в синхроне с выбором пользователя и, для
 * theme:"system", с изменением системной темы на лету. Вызывается один раз в App.tsx. */
export function applyThemeClass(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", resolveDark(theme));
  root.classList.toggle("light", !resolveDark(theme));
}
