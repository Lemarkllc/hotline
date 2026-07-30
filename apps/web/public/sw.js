// Офлайн app-shell (Фаза 7.4, PLAN.md §6) — кэшируем оболочку (сам SPA-документ +
// статику, с которой пользователь реально столкнулся), а не весь сайт целиком:
// у Vite имена собранных JS/CSS хэшированные, без build-time манифеста их не
// перечислить заранее, поэтому статика кэшируется по мере обращения (runtime cache),
// а не единым списком на "install". Версия кэша — единственный способ инвалидировать
// его для вернувшихся пользователей после деплоя новой сборки.
const CACHE_VERSION = "hotline-shell-v1";
const SHELL_URLS = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // API-запросы всегда идут в сеть напрямую — кэшировать/подменять живые данные
  // офлайн-оболочкой нельзя, у обращений и уведомлений нет смысла в "устаревшем офлайне".
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    // Переход по SPA-роуту (/dashboard, /appeals/:id...) — сеть в приоритете (свежий
    // index.html после деплоя), а при отсутствии сети отдаём закэшированную оболочку:
    // React Router сам разберётся с путём на клиенте после того, как приложение оживёт.
    event.respondWith(
      fetch(request).catch(() => caches.match("/").then((cached) => cached ?? caches.match(request))),
    );
    return;
  }

  // Статика (собранные JS/CSS, изображения) — кэш-приоритет с фоновым обновлением:
  // мгновенная отдача из кэша, кэш обновляется следующим успешным сетевым запросом.
  // cache.put() обёрнут в event.waitUntil() — без него это несвязанный fire-and-forget
  // промис, и браузер вправе убить воркер сразу как respondWith() отдаст ответ, так и не
  // записав кэш (что и происходило до этого — счётчик кэша не рос ни разу).
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)));
          }
          return response;
        })
        .catch(() => cached);
      return cached ?? networkFetch;
    }),
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { url: data.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
