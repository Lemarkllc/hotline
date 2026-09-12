import { escapeHtml } from "@/templates/lemarkEmailShell.js";
import type { ManagerStatsDTO } from "@/services/managerLeadRatingService.js";

function formatDate(d: Date): string {
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatCountRate(count: number, total: number): string {
  if (total === 0) return "—";
  return `${count}/${total} (${Math.round((count / total) * 100)}%)`;
}

/**
 * Еженедельная сводка «Рейтинг менеджеров» (2026-09-12) — та же таблица, что и на
 * странице /manager-rating (managerLeadRatingService.getStats). Без графика —
 * email-клиенты не выполняют JS/Recharts, статичная картинка отложена.
 *
 * НЕ переиспользует LEMARK_EMAIL_SHELL (lemarkEmailShell.ts) — та оболочка
 * рассчитана на клиентов/маркетинг (нав-меню "Каталог декоров/Продукция/Контакты",
 * контактный блок с телефоном/sales@, юридический футер с адресом). Получатели
 * здесь — Директор и РОП, свои же сотрудники: пользователь явно попросил убрать
 * весь этот "лишний" маркетинговый хидер/футер (2026-09-12, живая проверка
 * тестового письма) — своя минимальная шапка (только лого) и футер (одна строка
 * "автоматическое уведомление"), никакого нав-меню и контактного блока.
 */
export function renderWeeklyManagerDigestHtml(stats: ManagerStatsDTO[], from: Date, to: Date): string {
  const rows = stats
    .map(
      (m) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #E2E0DD;font:14px Arial,Helvetica,sans-serif;color:#1A1A1A;">${escapeHtml(m.name)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #E2E0DD;font:14px Arial,Helvetica,sans-serif;color:#41515B;text-align:right;">${m.total}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #E2E0DD;font:14px Arial,Helvetica,sans-serif;color:#41515B;text-align:right;">${m.slaViolations}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #E2E0DD;font:14px Arial,Helvetica,sans-serif;color:#41515B;text-align:right;">${formatCountRate(m.total - m.converted, m.total)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #E2E0DD;font:14px Arial,Helvetica,sans-serif;color:#41515B;text-align:right;">${formatCountRate(m.junk, m.total)}</td>
      </tr>`,
    )
    .join("");

  const title = "Рейтинг менеджеров — сводка за неделю";

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F3F0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F3F0;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background-color:#FFFFFF;border-radius:10px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:24px 24px 8px;">
              <img src="https://hot.lemarkllc.ru/icons/email-logo.png" width="150" alt="LEMARK" style="display:block;width:150px;max-width:100%;height:auto;">
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 32px;font-family:Arial,Helvetica,sans-serif;color:#41515B;">
              <h1 style="margin:0 0 6px;font:700 20px/28px Arial,Helvetica,sans-serif;color:#1A1A1A;">${escapeHtml(title)}</h1>
              <p style="margin:0 0 20px;font:14px/20px Arial,Helvetica,sans-serif;color:#41515B;">${formatDate(from)} — ${formatDate(to)}</p>

              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #E2E0DD;border-radius:10px;overflow:hidden;">
                <tr style="background-color:#F5F3F0;">
                  <td style="padding:10px 12px;font:700 12px Arial,Helvetica,sans-serif;color:#6E6C68;text-transform:uppercase;letter-spacing:0.5px;">Менеджер</td>
                  <td style="padding:10px 12px;font:700 12px Arial,Helvetica,sans-serif;color:#6E6C68;text-transform:uppercase;letter-spacing:0.5px;text-align:right;">Создано</td>
                  <td style="padding:10px 12px;font:700 12px Arial,Helvetica,sans-serif;color:#6E6C68;text-transform:uppercase;letter-spacing:0.5px;text-align:right;">SLA-нарушений</td>
                  <td style="padding:10px 12px;font:700 12px Arial,Helvetica,sans-serif;color:#6E6C68;text-transform:uppercase;letter-spacing:0.5px;text-align:right;">Не в сделке</td>
                  <td style="padding:10px 12px;font:700 12px Arial,Helvetica,sans-serif;color:#6E6C68;text-transform:uppercase;letter-spacing:0.5px;text-align:right;">Провалено</td>
                </tr>
                ${rows}
              </table>

              <p style="margin:20px 0 0;font:13px/20px Arial,Helvetica,sans-serif;color:#8A8780;">
                «Не в сделке» включает и ещё не решённые, и провальные лиды — «Провалено» входит в это число, столбцы пересекаются.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:16px 24px;background-color:#F5F3F0;border-top:1px solid #E2E0DD;">
              <p style="margin:0;font:12px/1.5 Arial,Helvetica,sans-serif;color:#8A8780;">
                Автоматическое уведомление · Lemark One
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
