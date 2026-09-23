import { randomBytes } from "node:crypto";
import { config } from "@/config/unifiedConfig.js";
import { logger } from "@/lib/logger.js";
import { ValidationError } from "@/types/index.js";

const SUBID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Панель, если не передать свой subId, генерирует его сама — на этом сервере
 * (после миграции 2026-09-23) её собственный генератор отдаёт полноценный UUID
 * (с дефисами, 36 символов) вместо короткой alnum-строки старых клиентов
 * (например "ghot5eq6xiilbdx1"). На выдачу подписки формат subId не влияет
 * (проверено вживую) — генерируем сами просто чтобы не зависеть от недокументированного
 * поведения панели и не делать лишний getByEmail сразу после create. */
function generateSubId(): string {
  const bytes = randomBytes(16);
  let result = "";
  for (const byte of bytes) {
    result += SUBID_ALPHABET[byte % SUBID_ALPHABET.length];
  }
  return result;
}

export interface VpnPanelClientDTO {
  email: string;
  subId: string;
  tgId: number;
  enable: boolean;
}

interface VpnPanelApiResponse<T> {
  success: boolean;
  msg?: string;
  obj?: T;
}

/** Тонкая обёртка над REST API панели 3X-UI (Xray) — Bearer-токен со scope=admin,
 * создан отдельно под HotLine (Settings → API Tokens в панели, не общий admin-
 * токен), проверено вживую 2026-09-22. Тот же принцип, что и bitrixService.ts —
 * никакого SDK, секрет уже в конфиге. */
export class VpnPanelService {
  private async call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    if (!config.vpn.panelBaseUrl || !config.vpn.apiToken) {
      throw new ValidationError("VPN-панель не настроена (VPN_PANEL_BASE_URL/VPN_PANEL_API_TOKEN)");
    }
    const url = `${config.vpn.panelBaseUrl.replace(/\/$/, "")}/panel/api${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${config.vpn.apiToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json()) as VpnPanelApiResponse<T>;
    if (!res.ok || !data.success) {
      throw new ValidationError(`VPN-панель (${method} ${path}): ${data.msg || res.statusText}`);
    }
    return data.obj as T;
  }

  /** Создаёт клиента и сразу прикрепляет к переданным inbound'ам одним вызовом
   * (POST /panel/api/clients/add). subId генерируем сами (generateSubId) и
   * возвращаем его вызывающей стороне — панели явно не доверяем сгенерировать
   * рабочий формат (см. комментарий у generateSubId). */
  async createClient(params: {
    email: string;
    tgId: number;
    limitHwid: number;
    inboundIds: readonly number[];
  }): Promise<{ subId: string }> {
    const subId = generateSubId();
    await this.call("POST", "/clients/add", {
      Client: {
        email: params.email,
        totalGB: 0,
        tgId: params.tgId,
        limitIp: 0,
        limitHwid: params.limitHwid,
        enable: true,
        subId,
      },
      inboundIds: [...params.inboundIds],
    });
    return { subId };
  }

  async getByEmail(email: string): Promise<VpnPanelClientDTO | null> {
    try {
      const obj = await this.call<{ client: { email: string; subId: string; tgId: number; enable: boolean } }>(
        "GET",
        `/clients/get/${encodeURIComponent(email)}`,
      );
      const c = obj.client;
      return { email: c.email, subId: c.subId, tgId: c.tgId, enable: c.enable };
    } catch (error) {
      logger.warn({ err: error, email }, "vpnPanelService: getByEmail failed");
      return null;
    }
  }

  /** Удаляет клиента из панели по email — необратимо (POST /clients/del/{email}).
   * Вызывается только при увольнении (userService.blockUser), по требованию
   * пользователя "профиль удаляется", не отключается. */
  async deleteClient(email: string): Promise<void> {
    await this.call("POST", `/clients/del/${encodeURIComponent(email)}`);
  }
}

export const vpnPanelService = new VpnPanelService();
