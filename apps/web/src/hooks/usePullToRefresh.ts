import { useEffect, useRef, useState } from "react";

const THRESHOLD = 70;
const MAX_PULL = 90;
const RESISTANCE = 0.5;

/** Свайп-вниз-чтобы-обновить (design ask: "как обновить без кеша в браузере") —
 * триггерит полную перезагрузку страницы, не просто рефетч React Query. Навигационные
 * запросы у нас и так идут network-first (см. sw.js), так что reload() уже тянет
 * актуальный HTML/данные, а не то, что лежит в offline-кэше service worker'а.
 *
 * containerRef не передан → следим за window/document (так скроллятся все вкладки
 * bottom tab bar — у MobileShell нет своего overflow-контейнера, обычный document-flow).
 * containerRef передан → следим за конкретным элементом (например, у AppealDetailMobile
 * свой overflow-y-auto блок под контентом карточки). */
export function usePullToRefresh(containerRef?: React.RefObject<HTMLElement>) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const pullingRef = useRef(false);

  useEffect(() => {
    const scrollEl = containerRef?.current ?? null;
    const target: EventTarget = scrollEl ?? window;

    function currentScrollTop(): number {
      if (scrollEl) return scrollEl.scrollTop;
      return document.scrollingElement?.scrollTop ?? window.scrollY;
    }

    function onTouchStart(e: Event) {
      const te = e as TouchEvent;
      if (currentScrollTop() > 0) return;
      startYRef.current = te.touches[0]!.clientY;
      pullingRef.current = true;
    }

    function onTouchMove(e: Event) {
      if (!pullingRef.current || startYRef.current === null) return;
      const te = e as TouchEvent;
      const delta = te.touches[0]!.clientY - startYRef.current;
      if (delta <= 0 || currentScrollTop() > 0) {
        pullingRef.current = false;
        setPullDistance(0);
        return;
      }
      // Тянем страницу вниз, а не скроллим её вверх системным жестом — иначе на
      // iOS это ещё и резиновый bounce-эффект самого Safari поверх нашего.
      e.preventDefault();
      setPullDistance(Math.min(delta * RESISTANCE, MAX_PULL));
    }

    function onTouchEnd() {
      if (!pullingRef.current) return;
      pullingRef.current = false;
      startYRef.current = null;
      setPullDistance((current) => {
        if (current >= THRESHOLD) {
          setRefreshing(true);
          window.location.reload();
        }
        return current;
      });
    }

    target.addEventListener("touchstart", onTouchStart, { passive: true });
    target.addEventListener("touchmove", onTouchMove, { passive: false });
    target.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      target.removeEventListener("touchstart", onTouchStart);
      target.removeEventListener("touchmove", onTouchMove);
      target.removeEventListener("touchend", onTouchEnd);
    };
  }, [containerRef]);

  return { pullDistance, refreshing, threshold: THRESHOLD };
}
