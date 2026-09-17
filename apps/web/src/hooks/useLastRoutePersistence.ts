import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const LAST_ROUTE_KEY = "hotline_last_route";

/** manifest.json start_url — куда iOS сажает standalone-PWA при холодном
 * перезапуске (полное вытеснение процесса из памяти при переключении в другое
 * приложение, например Safari/Bitrix24 — типичный триггер на телефоне). */
const START_URL_PATH = "/dashboard";

/**
 * Восстанавливает последний открытый экран после холодного перезапуска PWA на
 * iOS (живой баг-репорт пользователя, 2026-09-17): переключение в Bitrix24 из
 * карточки лида убивает процесс Lemark One, при возврате приложение стартует
 * заново по start_url из манифеста ("/dashboard"), а не с того экрана, где
 * пользователь был — контекст (например, «SLA Лиды») терялся. Один hasCheckedRestore
 * на монтирование AppShell = один раз за реальный холодный старт, не мешает
 * осознанным переходам на /dashboard из навигации.
 */
export function useLastRoutePersistence(): void {
  const location = useLocation();
  const navigate = useNavigate();
  const hasCheckedRestore = useRef(false);

  useEffect(() => {
    if (!hasCheckedRestore.current) {
      hasCheckedRestore.current = true;
      if (location.pathname === START_URL_PATH) {
        const saved = localStorage.getItem(LAST_ROUTE_KEY);
        if (saved && saved !== START_URL_PATH) {
          navigate(saved, { replace: true });
          return; // не перезаписываем localStorage уже устаревшим "/dashboard"
        }
      }
    }
    localStorage.setItem(LAST_ROUTE_KEY, location.pathname + location.search);
  }, [location.pathname, location.search, navigate]);
}
