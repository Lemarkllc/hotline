import { useAuthStore } from "./authStore";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | undefined,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let refreshPromise: Promise<boolean> | null = null;

/**
 * Разлогин, который не полагается только на то, что RequireAuth (реактивно
 * подписанный на accessToken) успеет перерендериться — жёсткий редирект гарантирует
 * выход из "залогинен в интерфейсе, но сервер уже не отвечает" состояния (сессия
 * истекла, пока вкладка простаивала) независимо от того, какой компонент сейчас
 * смонтирован. Проверка pathname — чтобы не зациклить редирект, если уже на /login.
 */
function forceLogout(): void {
  useAuthStore.getState().logout();
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

async function tryRefresh(): Promise<boolean> {
  const { refreshToken, setTokens } = useAuthStore.getState();
  if (!refreshToken) {
    forceLogout();
    return false;
  }
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      forceLogout();
      return false;
    }
    const data = (await res.json()) as { accessToken: string; refreshToken: string };
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    forceLogout();
    return false;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  skipAuth?: boolean;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  // BASE_URL может быть относительным (/api/v1 за Caddy в проде, same-origin) —
  // new URL() без base падает на относительной строке, поэтому передаём origin явно.
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, skipAuth } = options;
  const doFetch = async (): Promise<Response> => {
    const token = useAuthStore.getState().accessToken;
    return fetch(buildUrl(path, query), {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token && !skipAuth ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };

  let res = await doFetch();

  if (res.status === 401 && !skipAuth) {
    refreshPromise ??= tryRefresh().finally(() => {
      refreshPromise = null;
    });
    const refreshed = await refreshPromise;
    if (refreshed) {
      res = await doFetch();
      // Токен обновился, но запрос всё равно 401 — учётку заблокировали/удалили
      // между рефрешем и повтором запроса (см. requireWebAuth: "заблокирован"
      // тоже 401). Разлогиниваем сразу, а не оставляем висеть на ошибке.
      if (res.status === 401) forceLogout();
    }
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, data?.code, data?.message ?? "Ошибка запроса", data?.details);
  }
  return data as T;
}
