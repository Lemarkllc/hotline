import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles/globals.css";

// Регистрируем сервис-воркер сразу при загрузке, не дожидаясь логина/разрешения
// на push (см. webPush.ts — тот регистрирует тот же /sw.js повторно после входа,
// это идемпотентно) — иначе офлайн app-shell кэш (Фаза 7.4) не появится, пока
// пользователь ни разу не залогинится на этом устройстве.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
