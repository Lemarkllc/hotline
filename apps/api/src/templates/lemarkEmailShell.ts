/**
 * Фирменная "оболочка" письма Lemark (шапка с логотипом/навигацией, тёмно-синий
 * контактный блок, футер) — прислана пользователем как есть (html_template.html),
 * не редактируется. Плейсхолдеры {{EMAIL_TITLE}}/{{PREHEADER_TEXT}}/{{EMAIL_CONTENT}}
 * заполняются конкретными шаблонами письма (см. leadConfirmation.ts) через
 * renderInShell().
 */
export const LEMARK_EMAIL_SHELL = `<!doctype html>
<html lang="ru"
      xmlns="http://www.w3.org/1999/xhtml"
      xmlns:v="urn:schemas-microsoft-com:vml"
      xmlns:o="urn:schemas-microsoft-com:office:office">

<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta http-equiv="x-ua-compatible" content="ie=edge">
  <meta name="format-detection"
        content="telephone=no,address=no,email=no,date=no,url=no">

  <title>{{EMAIL_TITLE}}</title>

  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
        <o:AllowPNG/>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->

  <style type="text/css">
    html,
    body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      min-width: 100% !important;
    }

    table,
    td {
      border-collapse: collapse !important;
      mso-table-lspace: 0pt !important;
      mso-table-rspace: 0pt !important;
    }

    img {
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: bicubic;
    }

    a {
      text-decoration: none;
    }

    p,
    h1,
    h2,
    h3 {
      margin: 0;
      padding: 0;
    }

    #outlook a {
      padding: 0;
    }

    .ExternalClass {
      width: 100%;
    }

    .ExternalClass,
    .ExternalClass p,
    .ExternalClass span,
    .ExternalClass font,
    .ExternalClass td,
    .ExternalClass div {
      line-height: 100%;
    }

    @media only screen and (max-width: 620px) {
      .container {
        width: 100% !important;
        max-width: 100% !important;
      }

      .mobile-px {
        padding-left: 16px !important;
        padding-right: 16px !important;
      }

      .menu-link {
        display: inline-block !important;
        padding: 7px 5px !important;
        font-size: 12px !important;
      }

      .content-title {
        font-size: 27px !important;
        line-height: 1.15 !important;
      }

      .button-link {
        display: block !important;
        text-align: center !important;
      }

      .responsive-img {
        width: 100% !important;
        max-width: 100% !important;
        height: auto !important;
      }
    }
  </style>
</head>

<body style="margin:0;padding:0;background-color:#EEF3F6;">

  <!-- Текст предпросмотра письма -->
  <div style="
    display:none;
    max-height:0;
    max-width:0;
    overflow:hidden;
    opacity:0;
    color:transparent;
    mso-hide:all;
  ">
    {{PREHEADER_TEXT}}
  </div>

  <table role="presentation"
         width="100%"
         cellpadding="0"
         cellspacing="0"
         border="0"
         bgcolor="#EEF3F6"
         style="width:100%;background-color:#EEF3F6;">

    <tr>
      <td align="center" style="padding:24px 12px;">

        <!--[if mso]>
        <table role="presentation"
               width="600"
               cellpadding="0"
               cellspacing="0"
               border="0">
          <tr>
            <td>
        <![endif]-->

        <table role="presentation"
               width="600"
               cellpadding="0"
               cellspacing="0"
               border="0"
               class="container"
               bgcolor="#FFFFFF"
               style="
                 width:600px;
                 max-width:600px;
                 background-color:#FFFFFF;
               ">

          <!-- ====================================== -->
          <!-- ПОСТОЯННАЯ ШАПКА                       -->
          <!-- ====================================== -->

          <tr>
            <td align="center"
                class="mobile-px"
                style="padding:18px 24px 12px;">

              <a href="https://lemarkllc.ru/"
                 target="_blank"
                 style="display:inline-block;">

                <img
                  src="https://twevjw.stripocdn.email/content/guids/CABINET_4e7168d8fee1a19ffac01face9fb09783c851ff4bf085009e53bcd03f0ae6ee5/images/lemark.png"
                  width="210"
                  alt="LEMARK"
                  style="
                    display:block;
                    width:210px;
                    max-width:100%;
                    height:auto;
                  ">
              </a>
            </td>
          </tr>

          <tr>
            <td align="center"
                class="mobile-px"
                style="
                  padding:0 24px 15px;
                  font-family:Arial,Helvetica,sans-serif;
                ">

              <span class="menu-link"
                    style="display:inline-block;padding:6px 8px;">
                <a href="https://lemarkllc.ru/katalog-dekorov-hpl/"
                   target="_blank"
                   style="
                     font:700 13px/1.2 Arial,Helvetica,sans-serif;
                     color:#34434D;
                   ">
                  Каталог декоров
                </a>
              </span>

              <span class="menu-link"
                    style="display:inline-block;padding:6px 8px;">
                <a href="https://lemarkllc.ru/produkcziya/"
                   target="_blank"
                   style="
                     font:700 13px/1.2 Arial,Helvetica,sans-serif;
                     color:#34434D;
                   ">
                  Продукция
                </a>
              </span>

              <span class="menu-link"
                    style="display:inline-block;padding:6px 8px;">
                <a href="https://lemarkllc.ru/kontakty/"
                   target="_blank"
                   style="
                     font:700 13px/1.2 Arial,Helvetica,sans-serif;
                     color:#34434D;
                   ">
                  Контакты
                </a>
              </span>

            </td>
          </tr>

          <tr>
            <td bgcolor="#102A38"
                style="
                  height:5px;
                  background-color:#102A38;
                  font-size:0;
                  line-height:0;
                ">
              &nbsp;
            </td>
          </tr>

          <!-- ====================================== -->
          <!-- ИЗМЕНЯЕМЫЙ КОНТЕНТ ПИСЬМА              -->
          <!-- ====================================== -->

          <tr>
            <td class="mobile-px"
                style="
                  padding:38px 38px 42px;
                  font-family:Arial,Helvetica,sans-serif;
                  color:#41515B;
                ">

              {{EMAIL_CONTENT}}

            </td>
          </tr>

          <!-- ====================================== -->
          <!-- ПОСТОЯННЫЙ КОНТАКТНЫЙ БЛОК             -->
          <!-- ====================================== -->

          <tr>
            <td bgcolor="#102A38"
                class="mobile-px"
                align="center"
                style="
                  padding:32px 34px;
                  background-color:#102A38;
                  font-family:Arial,Helvetica,sans-serif;
                ">

              <p style="
                margin:0 0 8px;
                font:800 20px/1.3 Arial,Helvetica,sans-serif;
                color:#FFFFFF;
              ">
                ООО «ЛЕМАРК»
              </p>

              <p style="
                margin:0;
                font:14px/1.6 Arial,Helvetica,sans-serif;
                color:#DCE8EC;
              ">
                Производство декоративного бумажно-слоистого пластика HPL
              </p>

              <p style="
                margin:16px 0 0;
                font:14px/1.5 Arial,Helvetica,sans-serif;
                color:#C3D4DA;
              ">

                <a href="tel:+74952216336"
                   style="color:#FFFFFF;text-decoration:none;">
                  +7 495 221-63-36
                </a>

                &nbsp;&nbsp;·&nbsp;&nbsp;

                <a href="mailto:sales@lemarkllc.ru"
                   style="color:#FFFFFF;text-decoration:none;">
                  sales@lemarkllc.ru
                </a>

              </p>
            </td>
          </tr>

          <!-- ====================================== -->
          <!-- ПОСТОЯННЫЙ ФУТЕР                       -->
          <!-- ====================================== -->

          <tr>
            <td align="center"
                bgcolor="#0B1E28"
                class="mobile-px"
                style="
                  padding:20px 24px;
                  background-color:#0B1E28;
                  font-family:Arial,Helvetica,sans-serif;
                  color:#AFC2CA;
                ">

              <p style="
                margin:0;
                font:12px/1.55 Arial,Helvetica,sans-serif;
              ">
                ООО «ЛЕМАРК» · 141503, Московская область,
                г. Солнечногорск,<br>
                Бутырский тупик, вл. 4, стр. 1
              </p>

              <p style="
                margin:10px 0 0;
                font:12px/1.55 Arial,Helvetica,sans-serif;
              ">

                <a href="https://lemarkllc.ru/"
                   target="_blank"
                   style="
                     color:#FFFFFF;
                     text-decoration:underline;
                   ">
                  lemarkllc.ru
                </a>

              </p>

              <p style="
                margin:8px 0 0;
                font:12px/1.55 Arial,Helvetica,sans-serif;
                color:#7F969F;
              ">
                © 2026 LEMARK. Все права защищены.
              </p>

            </td>
          </tr>

        </table>

        <!--[if mso]>
            </td>
          </tr>
        </table>
        <![endif]-->

      </td>
    </tr>
  </table>

</body>
</html>`;

export function renderInShell(params: { title: string; preheader: string; content: string }): string {
  return LEMARK_EMAIL_SHELL.replace("{{EMAIL_TITLE}}", escapeHtml(params.title))
    .replace("{{PREHEADER_TEXT}}", escapeHtml(params.preheader))
    .replace("{{EMAIL_CONTENT}}", params.content);
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
