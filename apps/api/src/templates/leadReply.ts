import { escapeHtml, renderInShell } from "@/templates/lemarkEmailShell.js";

/** Та же ссылка на форму "Обратный звонок", что и в leadConfirmation.ts — см. её
 * комментарий там для истории проверки (200 OK, 2026-08-04). */
const BITRIX_CALLBACK_FORM_URL = "https://b24-3iqv0x.bitrix24site.ru/crm_form_9019y/";

/**
 * Ответ сотрудника клиенту прямо из карточки лида (leadService.reply) — намеренно
 * почти дословный повтор leadConfirmation.ts (бейдж, градиентный блок с номером
 * заявки, трекер из 3 шагов), чтобы оба письма читались как одна фирменная
 * последовательность, а не разные продукты. Меняется только контент: приветствие
 * не благодарит за обращение, а вводит ответ; градиентный блок оставлен как чистый
 * "номер заявки" без статусной строки (в подтверждении там текст про очередь —
 * в ответе это уже не нужно, сам ответ ниже говорит за себя); трекер продвинут на
 * шаг дальше (1 и 2 пройдены — заявка получена и изучена, это письмо тому
 * подтверждение); ниже трекера — сам текст ответа и подпись менеджера. CTA
 * "Заказать звонок" оставлен как есть — тот же сценарий "вопрос всё ещё срочный",
 * что и в автоответе.
 */
export function renderLeadReplyHtml(publicNumber: string, body: string, fromFullName: string): string {
  const number = escapeHtml(publicNumber);
  const name = escapeHtml(fromFullName);
  // Текстовое поле ответа — Enter отправляет, Shift+Enter переносит строку (см.
  // LeadDetailPage.tsx/MobileLeadDetail.tsx), поэтому переносы в теле реальны и их
  // нужно сохранить как <br>, а не схлопнуть в один абзац.
  const htmlBody = escapeHtml(body).replace(/\n/g, "<br>");

  const content = `
    <table cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
      <tr>
        <td style="background-color:#FDEEEF;border-radius:20px;padding:6px 14px;">
          <span style="font:700 13px/1.2 Arial,Helvetica,sans-serif;color:#C1272D;letter-spacing:0.3px;">
            Отдел продаж · ООО «ЛЕМАРК»
          </span>
        </td>
      </tr>
    </table>

    <h1 style="margin:0 0 6px;font:700 24px/32px Arial,Helvetica,sans-serif;color:#1A1A1A;">
      Здравствуйте!
    </h1>
    <p style="margin:0 0 24px;font:17px/26px Arial,Helvetica,sans-serif;color:#41515B;">
      Отвечаем на ваш вопрос по заявке в компанию <strong style="color:#102A38;">Lemark</strong>.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#102A38;background:linear-gradient(135deg,#102A38 0%,#1B4257 100%);border-radius:10px;margin-bottom:28px;">
      <tr>
        <td style="padding:24px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <p style="margin:0 0 4px;font:12px Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.7);letter-spacing:1px;text-transform:uppercase;">
                  Номер вашей заявки
                </p>
                <p style="margin:0;font:700 28px Arial,Helvetica,sans-serif;color:#FFFFFF;letter-spacing:0.5px;">
                  № ${number}
                </p>
              </td>
              <td width="60" style="vertical-align:middle;text-align:right;padding-left:16px;">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" valign="middle" style="min-width:52px;height:52px;background-color:#C1272D;border-radius:50%;">
                      <span style="font-size:26px;line-height:52px;color:#FFFFFF;">&#10003;</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td width="33%" style="vertical-align:top;padding-right:12px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="border-top:3px solid #102A38;padding-top:12px;">
                <p style="margin:0 0 4px;font:700 11px Arial,Helvetica,sans-serif;color:#102A38;letter-spacing:0.8px;text-transform:uppercase;">Шаг 1</p>
                <p style="margin:0;font:13px/19px Arial,Helvetica,sans-serif;color:#444444;">Заявка получена и зарегистрирована</p>
              </td>
            </tr>
          </table>
        </td>
        <td width="33%" style="vertical-align:top;padding-right:12px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="border-top:3px solid #102A38;padding-top:12px;">
                <p style="margin:0 0 4px;font:700 11px Arial,Helvetica,sans-serif;color:#102A38;letter-spacing:0.8px;text-transform:uppercase;">Шаг 2</p>
                <p style="margin:0;font:13px/19px Arial,Helvetica,sans-serif;color:#444444;">Менеджер изучил запрос</p>
              </td>
            </tr>
          </table>
        </td>
        <td width="33%" style="vertical-align:top;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="border-top:3px solid #CCCCCC;padding-top:12px;">
                <p style="margin:0 0 4px;font:700 11px Arial,Helvetica,sans-serif;color:#999999;letter-spacing:0.8px;text-transform:uppercase;">Шаг 3</p>
                <p style="margin:0;font:13px/19px Arial,Helvetica,sans-serif;color:#888888;">Ждём вашего ответа</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <div style="margin:0 0 28px;font:17px/27px Arial,Helvetica,sans-serif;color:#1A1A1A;">
      ${htmlBody}
    </div>

    <p style="margin:0 0 28px;font:15px/22px Arial,Helvetica,sans-serif;color:#41515B;">
      С уважением,<br>
      <strong style="color:#102A38;">${name}</strong><br>
      Отдел продаж ООО «ЛЕМАРК»
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F9FA;border-radius:10px;">
      <tr>
        <td style="padding:20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle;padding-right:20px;">
                <p style="margin:0 0 4px;font:700 15px Arial,Helvetica,sans-serif;color:#1A1A1A;">Вопрос срочный?</p>
                <p style="margin:0;font:13px/20px Arial,Helvetica,sans-serif;color:#666666;">Оставьте номер — перезвоним сами.</p>
              </td>
              <td style="vertical-align:middle;white-space:nowrap;">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="border-radius:6px;background-color:#102A38;">
                      <a href="${BITRIX_CALLBACK_FORM_URL}" target="_blank" style="display:inline-block;background-color:#102A38;color:#FFFFFF;font:700 14px Arial,Helvetica,sans-serif;text-decoration:none;padding:12px 22px;border-radius:6px;">
                        Заказать звонок
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  const preheader = body.length > 140 ? `${body.slice(0, 140)}…` : body;

  return renderInShell({
    title: `Ответ по заявке № ${publicNumber} — Lemark`,
    preheader,
    content,
  });
}
