import { apiRequest } from "./apiClient";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Регистрирует service worker, запрашивает разрешение на пуш (один раз — браузер сам
 * помнит отказ/согласие) и отправляет подписку на бэкенд. Best-effort: ошибки не должны
 * ломать остальной интерфейс (несовместимый браузер, отклонённое разрешение и т.п.). */
export async function setupWebPush(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (Notification.permission === "denied") return;

  try {
    const { publicKey } = await apiRequest<{ publicKey: string }>("/push/public-key", { skipAuth: true });
    if (!publicKey) return; // сервер не сконфигурирован (нет VAPID-ключей)

    const registration = await navigator.serviceWorker.register("/sw.js");

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;
    await apiRequest("/push/subscribe", {
      method: "POST",
      body: { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } },
    });
  } catch {
    // Молча пропускаем — push лишь дополняет раздел "Уведомления", не заменяет его.
  }
}
