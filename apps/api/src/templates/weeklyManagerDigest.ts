import { escapeHtml, renderInShell } from "@/templates/lemarkEmailShell.js";
import type { ManagerStatsDTO } from "@/services/managerLeadRatingService.js";

function formatDate(d: Date): string {
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatCountRate(count: number, total: number): string {
  if (total === 0) return "—";
  return `${count}/${total} (${Math.round((count / total) * 100)}%)`;
}

/**
 * Еженедельная сводка «Рейтинг менеджеров» (2026-09-12, пользователь: "хорошо бы
 * в красивом HTML письмо сводку за неделю отправлять") — та же таблица, что и на
 * странице /manager-rating (managerLeadRatingService.getStats), просто в HTML для
 * почты. Без графика — email-клиенты не выполняют JS/Recharts, статичная картинка
 * заметно дороже, отложено (решение пользователя).
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

  const content = `
    <h1 style="margin:0 0 6px;font:700 22px/30px Arial,Helvetica,sans-serif;color:#1A1A1A;">
      Рейтинг менеджеров — сводка за неделю
    </h1>
    <p style="margin:0 0 24px;font:15px/22px Arial,Helvetica,sans-serif;color:#41515B;">
      ${formatDate(from)} — ${formatDate(to)}
    </p>

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

    <p style="margin:24px 0 0;font:13px/20px Arial,Helvetica,sans-serif;color:#8A8780;">
      «Не в сделке» включает и ещё не решённые, и провальные лиды — «Провалено» входит в это число, столбцы пересекаются.
    </p>
  `;

  return renderInShell({
    title: "Рейтинг менеджеров — сводка за неделю",
    preheader: `Сводка по 6 менеджерам за ${formatDate(from)} — ${formatDate(to)}`,
    content,
  });
}
