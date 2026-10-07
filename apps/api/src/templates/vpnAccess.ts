import { config } from "@/config/unifiedConfig.js";
import { VPN_INCY_APP_STORE_URL, VPN_INCY_GOOGLE_PLAY_URL } from "@/config/vpnConfig.js";
import { escapeHtml, renderInShell } from "@/templates/lemarkEmailShell.js";

/** Страница коннектора в Lemark One: открывает подписку сразу в приложении. */
export function vpnConnectorUrl(subscriptionUrl: string): string {
  return `${config.email.webAppUrl.replace(/\/$/, "")}/vpn-connect?url=${encodeURIComponent(subscriptionUrl)}`;
}

/**
 * Письмо с доступом к VPN (раздел «VPN» Администратора). Решение пользователя
 * 2026-10-07: кратко и по делу, без вводных фраз — кнопка, ссылка, два шага, предупреждение.
 */
export function renderVpnAccessHtml(params: { fullName: string; subscriptionUrl: string; deviceLimit: number }): string {
  const [, firstName, patronymic] = params.fullName.trim().split(/\s+/);
  const name = escapeHtml([firstName, patronymic].filter(Boolean).join(" ") || params.fullName);
  const subUrl = escapeHtml(params.subscriptionUrl);
  const connectUrl = escapeHtml(vpnConnectorUrl(params.subscriptionUrl));
  const text = "font:16px/24px Arial,Helvetica,sans-serif;color:#41515B;";

  const content = `
    <h1 style="margin:0 0 18px;font:700 22px/30px Arial,Helvetica,sans-serif;color:#1A1A1A;">
      ${name}, ваш доступ к VPN
    </h1>

    <p style="margin:0 0 8px;${text}">
      1. Установите INCY:
      <a href="${VPN_INCY_APP_STORE_URL}" target="_blank" style="color:#C1272D;">App Store</a> ·
      <a href="${VPN_INCY_GOOGLE_PLAY_URL}" target="_blank" style="color:#C1272D;">Google Play</a>
    </p>
    <p style="margin:0 0 20px;${text}">
      2. Откройте это письмо на том же устройстве и нажмите «Подключить».
    </p>

    <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td align="center" style="border-radius:6px;background-color:#102A38;">
          <a href="${connectUrl}" target="_blank" style="display:inline-block;background-color:#102A38;color:#FFFFFF;font:700 15px Arial,Helvetica,sans-serif;text-decoration:none;padding:13px 30px;border-radius:6px;">
            Подключить
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 4px;font:13px/20px Arial,Helvetica,sans-serif;color:#6B7A83;">
      Ссылка подписки (если кнопка не сработала — добавьте вручную в приложении):
    </p>
    <p style="margin:0 0 24px;font:13px/20px 'Courier New',monospace;color:#102A38;word-break:break-all;">
      ${subUrl}
    </p>

    <p style="margin:0;padding:12px 16px;background-color:#FDEEEF;border-radius:6px;font:14px/21px Arial,Helvetica,sans-serif;color:#7A1A1E;">
      Ссылка личная — не пересылайте её. Устройств: до ${params.deviceLimit}.
    </p>
  `;

  return renderInShell({ title: "Доступ к VPN", preheader: "Ссылка на VPN и кнопка подключения", content });
}
