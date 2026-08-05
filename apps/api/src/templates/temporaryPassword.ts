import { config } from "@/config/unifiedConfig.js";
import { escapeHtml, renderInShell } from "@/templates/lemarkEmailShell.js";

/**
 * Внутреннее системное письмо (создание веб-аккаунта / сброс пароля в HotLineBot) —
 * та же фирменная оболочка Lemark (шапка/футер), что и у письма-подтверждения
 * заявки, но отправитель другой ("Lemark HotLine", не "Lemark"/sales@, см.
 * config.email.systemFromAddress) и аудитория другая — сотрудник, а не клиент.
 */
export function renderTemporaryPasswordHtml(fullName: string, temporaryPassword: string): string {
  const name = escapeHtml(fullName);
  const password = escapeHtml(temporaryPassword);
  const loginUrl = escapeHtml(config.email.webAppUrl);

  const content = `
    <table cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
      <tr>
        <td style="background-color:#FDEEEF;border-radius:20px;padding:6px 14px;">
          <span style="font:700 13px/1.2 Arial,Helvetica,sans-serif;color:#C1272D;letter-spacing:0.3px;">
            HotLineBot · доступ к панели
          </span>
        </td>
      </tr>
    </table>

    <h1 style="margin:0 0 6px;font:700 24px/32px Arial,Helvetica,sans-serif;color:#1A1A1A;">
      Здравствуйте, ${name}!
    </h1>
    <p style="margin:0 0 24px;font:17px/26px Arial,Helvetica,sans-serif;color:#41515B;">
      Для вас создан (или обновлён) доступ к панели <strong style="color:#102A38;">HotLineBot</strong>.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#102A38;background:linear-gradient(135deg,#102A38 0%,#1B4257 100%);border-radius:10px;margin-bottom:28px;">
      <tr>
        <td style="padding:24px 28px;">
          <p style="margin:0 0 4px;font:12px Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.7);letter-spacing:1px;text-transform:uppercase;">
            Временный пароль
          </p>
          <p style="margin:0 0 12px;font:700 24px/1.3 Arial,Helvetica,sans-serif;color:#FFFFFF;letter-spacing:0.5px;font-family:'Courier New',monospace;">
            ${password}
          </p>
          <p style="margin:0;font:15px/22px Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.92);">
            При первом входе система попросит<br>
            <strong style="color:#FFFFFF;">задать собственный пароль</strong>.
          </p>
        </td>
      </tr>
    </table>

    <table cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="border-radius:6px;background-color:#102A38;">
          <a href="${loginUrl}" target="_blank" style="display:inline-block;background-color:#102A38;color:#FFFFFF;font:700 14px Arial,Helvetica,sans-serif;text-decoration:none;padding:12px 26px;border-radius:6px;">
            Войти в панель
          </a>
        </td>
      </tr>
    </table>
  `;

  return renderInShell({
    title: "Доступ к HotLineBot",
    preheader: `Ваш временный пароль для входа в HotLineBot: ${temporaryPassword}`,
    content,
  });
}
