import { randomBytes } from "node:crypto";
import { config } from "@/config/unifiedConfig.js";
import { logger } from "@/lib/logger.js";
import { ValidationError } from "@/types/index.js";

const SUBID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** User-Agent служебных запросов сырой подписки — см. fetchRawSubscription. */
export const MERGE_FETCHER_UA = "HotLineMergeFetcher";

/** Панель, если не передать свой subId, генерирует его сама — на этом сервере
 * (после миграции 2026-09-23) её собственный генератор отдаёт полноценный UUID
 * (с дефисами, 36 символов) вместо короткой alnum-строки старых клиентов
 * (например "ghot5eq6xiilbdx1"). На выдачу подписки формат subId не влияет
 * (проверено вживую) — генерируем сами просто чтобы не зависеть от недокументированного
 * поведения панели и не делать лишний getByEmail сразу после create. */
export function generateSubId(): string {
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
  /** Inbound'ы, к которым привязан клиент — по нему бэкфилл AmneziaWG
   * (scripts/backfillVpnAwg.ts) понимает, привязан ли уже AmneziaWG-inbound. */
  inboundIds: number[];
  /** Лимит устройств клиента на панели; 0 — без ограничения. Может отличаться от
   * VPN_PROFILE_HWID_LIMIT: администратор поднимает его отдельным сотрудникам. */
  limitHwid: number;
}

export interface VpnPanelClientSummary {
  email: string;
  subId: string;
  /** 0 — без ограничения. */
  limitHwid: number;
  enable: boolean;
  /** Накопительные счётчики, байты. */
  up: number;
  down: number;
  /** Последний запрос подписки, мс Unix; null — не запрашивалась. */
  lastSubFetch: number | null;
}

/** Устройство клиента на панели (HWID), как его отдаёт POST /clients/hwids/{email}.
 * Время — миллисекунды Unix. */
export interface VpnPanelDeviceDTO {
  id: number;
  firstSeen: number;
  lastSeen: number;
  userAgent?: string;
  deviceOs?: string;
  osVersion?: string;
  deviceModel?: string;
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
  private async call<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
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
    comment?: string;
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
        ...(params.comment ? { comment: params.comment } : {}),
      },
      inboundIds: [...params.inboundIds],
    });
    return { subId };
  }

  /** Привязывает существующего клиента к дополнительным inbound'ам
   * (POST /panel/api/clients/{email}/attach, найдено в /panel/api/openapi.json
   * 2026-09-30). Для WireGuard/AmneziaWG панель сама выделяет клиенту свободный /32
   * в туннеле — проверено вживую на тестовом клиенте. */
  async attachInbounds(email: string, inboundIds: readonly number[]): Promise<void> {
    await this.call("POST", `/clients/${encodeURIComponent(email)}/attach`, { inboundIds: [...inboundIds] });
  }

  /** Устройства (HWID), зарегистрированные на клиенте — POST /panel/api/clients/hwids/{email}
   * (да, POST, хотя это чтение — так в OpenAPI панели). Сама панель неактивные
   * устройства не забывает никогда, см. vpnService.cleanupStaleDevices. */
  async listDevices(email: string): Promise<VpnPanelDeviceDTO[]> {
    const obj = await this.call<VpnPanelDeviceDTO[] | null>("POST", `/clients/hwids/${encodeURIComponent(email)}`);
    return obj ?? [];
  }

  /** Удаляет одно устройство, освобождая место под лимитом (DELETE …/hwids/{email}/{id}). */
  async deleteDevice(email: string, deviceId: number): Promise<void> {
    await this.call("DELETE", `/clients/hwids/${encodeURIComponent(email)}/${deviceId}`);
  }

  /** Все клиенты панели одним запросом (GET /clients/list) — со счётчиками трафика.
   * Раздел VPN администратора и ночные снимки (vpnUsageService) берут данные отсюда,
   * а не запросом на каждого сотрудника. Секретные поля клиента сюда не попадают. */
  async listAllClients(): Promise<VpnPanelClientSummary[]> {
    const items = await this.call<
      {
        email: string;
        subId: string;
        limitHwid?: number;
        enable: boolean;
        traffic?: { up?: number; down?: number; lastSubFetch?: number; lastOnline?: number } | null;
      }[]
    >("GET", "/clients/list");
    return (items ?? []).map((c) => ({
      email: c.email,
      subId: c.subId,
      limitHwid: c.limitHwid ?? 0,
      enable: c.enable,
      up: c.traffic?.up ?? 0,
      down: c.traffic?.down ?? 0,
      lastSubFetch: c.traffic?.lastSubFetch || null,
    }));
  }

  /** Лимит устройств клиента (POST /clients/bulkAdjust {emails, limitHwid}) — меняет
   * только лимит, без полной перезаписи клиента (clients/update требует весь объект). */
  async setDeviceLimit(email: string, limitHwid: number): Promise<void> {
    await this.call("POST", "/clients/bulkAdjust", { emails: [email], limitHwid });
  }

  /** Массовые операции для бэкфилла (scripts/backfillVpnAwg.ts): по OpenAPI панели
   * bulk-вызовы перезапускают Xray ОДИН раз в конце, а одиночные attach/add на
   * десятках клиентов могли бы дёргать соединения всех сотрудников много раз. */
  async bulkAttach(emails: readonly string[], inboundIds: readonly number[]): Promise<{ attached: string[]; skipped: string[]; errors: unknown[] }> {
    const obj = await this.call<{ attached?: string[]; skipped?: string[]; errors?: unknown[] }>("POST", "/clients/bulkAttach", {
      emails: [...emails],
      inboundIds: [...inboundIds],
    });
    return { attached: obj?.attached ?? [], skipped: obj?.skipped ?? [], errors: obj?.errors ?? [] };
  }

  async bulkCreate(
    items: readonly { email: string; subId: string; tgId: number; limitHwid: number; comment?: string; inboundIds: readonly number[] }[],
  ): Promise<{ created: number; skipped: { email: string; reason: string }[] }> {
    const obj = await this.call<{ created?: number; skipped?: { email: string; reason: string }[] }>(
      "POST",
      "/clients/bulkCreate",
      items.map((i) => ({
        client: { email: i.email, subId: i.subId, tgId: i.tgId, totalGB: 0, limitIp: 0, limitHwid: i.limitHwid, enable: true, ...(i.comment ? { comment: i.comment } : {}) },
        inboundIds: [...i.inboundIds],
      })),
    );
    return { created: obj?.created ?? 0, skipped: obj?.skipped ?? [] };
  }

  /** Сырая подписка клиента (не JSON): нейтральный User-Agent не совпадает с
   * subJsonUserAgentRegex панели, поэтому она отдаёт список ссылок, где AmneziaWG
   * идёт как vpn://… — в JSON для Happ/INCY его нет. X-HWID передаём только для
   * клиента под лимитом устройств (слот 1), вспомогательному (слот 2) он не нужен. */
  async fetchRawSubscription(
    subId: string,
    device?: { hwid: string; appUserAgent?: string; headers?: Record<string, string> },
  ): Promise<string> {
    const url = `${config.vpn.subBaseUrl.replace(/\/$/, "")}/${subId}`;
    // С X-HWID панель обновляет запись устройства этим запросом (User-Agent, ОС,
    // модель) — поэтому передаём заголовки устройства и прячем настоящий User-Agent
    // приложения в скобки: "HotLineMergeFetcher (INCY/2.6.2/ios …)" не совпадает с
    // subJsonUserAgentRegex (нужен сырой список, не JSON), а «Мои устройства VPN»
    // достаёт из скобок исходное приложение (vpnService.toDeviceView). Иначе после
    // каждого обновления INCY в списке значилось бы «HotLineMergeFetcher».
    const headers: Record<string, string> = {
      ...(device?.headers ?? {}),
      "User-Agent": device?.appUserAgent ? `${MERGE_FETCHER_UA} (${device.appUserAgent})` : `${MERGE_FETCHER_UA}/1.0`,
    };
    if (device?.hwid) headers["X-HWID"] = device.hwid;
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new ValidationError(`VPN-панель: сырая подписка вернула ${res.status}`);
    return res.text();
  }

  async getByEmail(email: string): Promise<VpnPanelClientDTO | null> {
    try {
      const obj = await this.call<{
        client: { email: string; subId: string; tgId: number; enable: boolean; limitHwid?: number };
        inboundIds?: number[];
      }>("GET", `/clients/get/${encodeURIComponent(email)}`);
      const c = obj.client;
      return {
        email: c.email,
        subId: c.subId,
        tgId: c.tgId,
        enable: c.enable,
        inboundIds: obj.inboundIds ?? [],
        limitHwid: c.limitHwid ?? 0,
      };
    } catch (error) {
      // «Клиента нет» — штатный ответ, не сбой: так проверяются свободные логины
      // (findFreePanelEmail) и устаревшие профили (автоочистка устройств обходит их
      // каждый запуск). На warn со стеком это засоряло логи; настоящие сбои связи с
      // панелью (таймаут, 5xx, не настроена) по-прежнему warn.
      if (error instanceof Error && /record not found/i.test(error.message)) {
        logger.debug({ email }, "vpnPanelService: клиента с таким email на панели нет");
      } else {
        logger.warn({ err: error, email }, "vpnPanelService: getByEmail failed");
      }
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
