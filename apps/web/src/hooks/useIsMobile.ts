import { useEffect, useState } from "react";

const QUERY = "(max-width: 767px)";

/** Брейкпоинт для переключения между десктоп-панелью (Sidebar+Topbar) и
 * мобильной (bottom tab bar, полноэкранные карточки) — Фаза 7.4, по мотивам
 * прототипа design_handoff_mobile_pwa/. matchMedia, а не просто CSS-классы:
 * структура интерфейса (навигация, оверлеи) различается достаточно сильно,
 * чтобы решать это в JS, а не reflow'ом одного и того же DOM через Tailwind-брейкпоинты. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(QUERY).matches);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
