import { escapeHtml, renderInShell } from "@/templates/lemarkEmailShell.js";

/** Готовая форма "Обратный звонок", размещённая самим Bitrix24 (crm-форма,
 * b24-3iqv0x.bitrix24site.ru) — обычная ссылка, проверена вживую (200 OK,
 * 2026-08-04). Виджет-версия (inline JS-loader) в письме не сработает — email-
 * клиенты не выполняют скрипты, поэтому используется именно standalone-URL формы. */
const BITRIX_CALLBACK_FORM_URL = "https://b24-3iqv0x.bitrix24site.ru/crm_form_9019y/";

/**
 * Стиль подсмотрен пользователем в письме другой компании (бейдж, градиентный
 * блок с номером заявки, трекер из 3 шагов, CTA) — адаптирован под фирменную
 * оболочку Lemark (lemarkEmailShell.ts, шапка/футер не меняются). Раздел с видео
 * и "карточками о компании" из примера-образца сюда НЕ перенесён: там были
 * факты/ссылки конкретно NLS Силикон, у нас таких данных нет — не придумываем.
 * Красный (#C1272D) — акцент из логотипа Lemark, тёмно-синий (#102A38) — уже
 * фирменный цвет шапки/футера оболочки, не новый цвет.
 */
export function renderLeadConfirmationHtml(publicNumber: string): string {
  const number = escapeHtml(publicNumber);

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
      Благодарим за обращение в компанию <strong style="color:#102A38;">Lemark</strong>.
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
                <p style="margin:0 0 12px;font:700 28px Arial,Helvetica,sans-serif;color:#FFFFFF;letter-spacing:0.5px;">
                  № ${number}
                </p>
                <p style="margin:0;font:15px/22px Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.92);">
                  Заявка передана в отдел продаж и<br>
                  <strong style="color:#FFFFFF;">поставлена в очередь на обработку</strong>.
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
              <td style="border-top:3px solid #CCCCCC;padding-top:12px;">
                <p style="margin:0 0 4px;font:700 11px Arial,Helvetica,sans-serif;color:#999999;letter-spacing:0.8px;text-transform:uppercase;">Шаг 2</p>
                <p style="margin:0;font:13px/19px Arial,Helvetica,sans-serif;color:#888888;">Менеджер изучит запрос</p>
              </td>
            </tr>
          </table>
        </td>
        <td width="33%" style="vertical-align:top;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="border-top:3px solid #CCCCCC;padding-top:12px;">
                <p style="margin:0 0 4px;font:700 11px Arial,Helvetica,sans-serif;color:#999999;letter-spacing:0.8px;text-transform:uppercase;">Шаг 3</p>
                <p style="margin:0;font:13px/19px Arial,Helvetica,sans-serif;color:#888888;">Свяжемся с вами в ближайшее время</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

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

  return renderInShell({
    title: `Ваша заявка получена — Lemark`,
    preheader: `Заявка №${publicNumber} принята и зарегистрирована. Свяжемся с вами в ближайшее время.`,
    content,
  });
}
