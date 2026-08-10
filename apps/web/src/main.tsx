import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles/globals.css";

// Регистрируем сервис-воркер сразу при загрузке, не дожидаясь логина/разрешения
// на push (см. webPush.ts — тот регистрирует тот же /sw.js повторно после входа,
// это идемпотентно) — иначе офлайн app-shell кэш (Фаза 7.4) не появится, пока
// пользователь ни разу не залогинится на этом устройстве.
//
// Автообновление PWA (реальный кейс: пользователь пожаловался, что после деплоя
// фикса на телефоне "ничего не поменялось" даже после многократного закрытия
// приложения свайпом) — установленный PWA часто не делает полноценную навигацию
// при "открытии" (ОС просто возобновляет уже загруженный процесс), поэтому браузер
// годами не перепроверяет /sw.js на изменения сам. sw.js уже зовёт self.skipWaiting()
// при install — новый воркер становится активным быстро, но уже открытая страница
// продолжает работать со старым JS в памяти, пока её не перезагрузить явно.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    const registration = await navigator.serviceWorker.register("/sw.js");

    // Возврат из фона/на передний план — ближайший аналог "открытия" для уже
    // запущенного PWA-процесса, здесь и форсируем проверку обновлений.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void registration.update();
    });

    // reloaded — иначе на медленной сети reload мог бы сработать дважды подряд.
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
