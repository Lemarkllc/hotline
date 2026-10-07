import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/unifiedConfig.js", () => ({ config: { email: { webAppUrl: "https://hot.lemarkllc.ru" } } }));

import { renderVpnAccessHtml, vpnConnectorUrl } from "@/templates/vpnAccess.js";

const SUB = "https://hot.lemarkllc.ru/api/v1/vpn/sub/abc123";

describe("письмо с доступом к VPN", () => {
  const html = renderVpnAccessHtml({ fullName: "Иванов Иван Иванович", subscriptionUrl: SUB, deviceLimit: 3 });

  it("кнопка «Подключить» ведёт на коннектор с подпиской", () => {
    expect(vpnConnectorUrl(SUB)).toBe(`https://hot.lemarkllc.ru/vpn-connect?url=${encodeURIComponent(SUB)}`);
    expect(html).toContain(`href="${vpnConnectorUrl(SUB)}"`);
    expect(html).toContain("Подключить");
  });

  it("есть ссылка подписки текстом, INCY в обоих сторах, лимит и предупреждение", () => {
    expect(html).toContain(SUB);
    expect(html).toContain("apps.apple.com/app/incy");
    expect(html).toContain("play.google.com/store/apps/details?id=llc.itdev.incy");
    expect(html).toContain("до 3");
    expect(html).toContain("не пересылайте");
  });

  it("обращение по имени и отчеству, без вводных фраз", () => {
    expect(html).toContain("Иван Иванович, ваш доступ к VPN");
    expect(html).not.toMatch(/Здравствуйте|рады|С уважением|Добро пожаловать/);
  });

  it("ФИО экранируется", () => {
    expect(renderVpnAccessHtml({ fullName: "<b>X</b> <i>Y</i>", subscriptionUrl: SUB, deviceLimit: 2 })).not.toContain("<i>Y</i>");
  });
});
