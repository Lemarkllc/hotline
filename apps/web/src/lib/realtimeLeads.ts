import { useEffect } from "react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/authStore";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1";
// socket.io подключается к origin (хосту), а не к REST-пути — /api/v1 отрезаем.
// В проде VITE_API_BASE_URL относительный ("/api/v1"), тогда SOCKET_ORIGIN пустой —
// socket.io-client сам резолвит его в текущий origin страницы (Caddy same-origin).
const SOCKET_ORIGIN = BASE_URL.startsWith("http") ? new URL(BASE_URL).origin : "";

/**
 * Live-обновление списка «Заявок» через Socket.IO (namespace /leads, см.
 * apps/api/src/lib/realtime.ts) — вместо ожидания следующего 15-секундного poll'а
 * useLeads() просто дёргается раньше через invalidateQueries. Сам список данных
 * по-прежнему приходит через REST (useLeads) — сокет только сигнал "обнови сейчас",
 * не дублирует форму данных.
 *
 * Best-effort: обрыв соединения/ошибка авторизации не ломает страницу — polling
 * (уже существующий refetchInterval) остаётся рабочим резервным механизмом.
 */
export function useLeadsRealtime(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = io(`${SOCKET_ORIGIN}/leads`, {
      // Функция, а не статическое значение — токен мог обновиться (refresh) между
      // переподключениями сокета, читаем актуальный из стора на каждой попытке.
      auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
      reconnectionDelay: 2000,
    });

    socket.on("lead:new", () => {
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      void queryClient.invalidateQueries({ queryKey: ["lead-conversion-stats"] });
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient]);
}
