import { config } from "@/config/unifiedConfig.js";
import { logger } from "@/lib/logger.js";
import { VPN_PROFILE_HWID_LIMIT, VPN_STANDARD_INBOUND_IDS } from "@/config/vpnConfig.js";
import { vpnPanelService } from "@/services/vpnPanelService.js";
import { vpnProfileRepository } from "@/repositories/VpnProfileRepository.js";
import { userRepository } from "@/repositories/UserRepository.js";
import { transliterateToLogin } from "@/utils/transliterate.js";
import { ForbiddenError } from "@/types/index.js";

export interface VpnAccessDTO {
  subscriptionUrl: string;
  /** true — у сотрудника уже был профиль, показываем ту же ссылку заново (решение
   * пользователя 2026-09-22: повторное "Получить VPN" не создаёт второй профиль). */
  alreadyExisted: boolean;
}

/**
 * «Получить VPN» (боковое меню бота-сотрудника) — создаёт персональный профиль на
 * 3X-UI (vpnPanelService), даёт ссылку подписки. Отзыв — при увольнении
 * (userService.blockUser вызывает revokeProfile).
 */
/** Ответ upstream-панели на /sub/<subId>, который проксируем как есть, кроме
 * Profile-Title (см. VpnService.proxySubscription). */
export interface VpnSubscriptionProxyResult {
  status: number;
  headers: Headers;
  body: ArrayBuffer;
}

export class VpnService {
  /** Ссылка, которую получают сотрудники, — НАШ домен, не панель напрямую
   * (config.vpn.subBaseUrl остаётся только upstream-адресом для proxySubscription).
   * Нужно, чтобы подменять Profile-Title на персональный (решение пользователя
   * 2026-09-23: у каждого сотрудника своё имя вместо общего "LEMARK LLC" — иначе
   * не отличить свой профиль среди старых одноимённых в приложении). */
  getSubscriptionUrl(subId: string): string {
    return `${config.vpn.subPublicBaseUrl}${subId}`;
  }

  /** Проксирует запрос подписки на реальную панель (config.vpn.subBaseUrl) и
   * подменяет заголовок Profile-Title на персональный — сама подписка (конфиги
   * VLESS/Hysteria2 и т.д.) от панели не меняется, только эта одна шапка.
   * X-HWID пробрасываем как есть — панель сама решает по нему лимит устройств
   * (см. vpnConfig.ts, найдено вживую 2026-09-23), проксирование не должно
   * это ломать. User-Agent тоже пробрасываем как есть — панель отдаёт РАЗНЫЙ
   * формат ответа по нему: обычному клиенту (без User-Agent конкретного
   * приложения) — простой base64-список ссылок, а Happ — расширенный JSON с
   * авто-выбором сервера (burstObservatory/pingConfig) — без проброса Happ
   * получал урезанный формат и терял авто-выбор, подтверждено вживую 2026-09-23. */
  async proxySubscription(
    subId: string,
    incomingHwid: string | undefined,
    incomingUserAgent: string | undefined,
  ): Promise<VpnSubscriptionProxyResult> {
    const upstreamUrl = `${config.vpn.subBaseUrl.replace(/\/$/, "")}/${subId}`;
    const upstreamHeaders: Record<string, string> = {};
    if (incomingHwid) upstreamHeaders["X-HWID"] = incomingHwid;
    if (incomingUserAgent) upstreamHeaders["User-Agent"] = incomingUserAgent;
    const upstreamRes = await fetch(upstreamUrl, { headers: upstreamHeaders });
    const body = await upstreamRes.arrayBuffer();
    const headers = new Headers(upstreamRes.headers);

    if (upstreamRes.ok) {
      const profile = await vpnProfileRepository.findActiveBySubId(subId);
      if (profile) {
        // Итоговый формат после двух правок по обратной связи 2026-09-23:
        // сначала "LEMARK — Полное Имя" (длинно), потом "LEMARK — Фамилия"
        // (всё ещё длинно), сейчас — просто "Фамилия И." без префикса бренда.
        // В этой БД fullName хранится как "Фамилия Имя Отчество" (первое слово —
        // фамилия), тот же порядок, на котором уже строится login в панели,
        // см. transliterateToLogin.
        const [surname, firstName] = profile.user.fullName.trim().split(/\s+/);
        const title = firstName ? `${surname} ${firstName[0]!.toUpperCase()}.` : (surname ?? profile.user.fullName);
        headers.set("profile-title", `base64:${Buffer.from(title, "utf-8").toString("base64")}`);
      }
      this.rewriteRoutingGeoUrls(headers);
    }

    return { status: upstreamRes.status, headers, body };
  }

  /** Реальная жалоба 2026-09-25: Routing-заголовок (happ://routing/add/<base64 JSON>)
   * несёт Geoipurl/Geositeurl на github.com — приложение качает их напрямую, до
   * установки VPN, и у многих российских провайдеров это виснет. Подменяем на
   * наши же /vpn/geoip.dat и /vpn/geosite.dat (см. vpnGeoDataService) — тот же
   * домен, что уже и так отдаёт клиенту подписку, значит заведомо доступен без
   * VPN. Best-effort: любая неожиданность в формате заголовка — оставляем как
   * пришло от панели, не ломаем остальную подписку ради этой правки. */
  private rewriteRoutingGeoUrls(headers: Headers): void {
    const routing = headers.get("routing");
    if (!routing) return;
    const prefix = "happ://routing/add/";
    if (!routing.startsWith(prefix)) return;

    try {
      const decoded = JSON.parse(Buffer.from(routing.slice(prefix.length), "base64").toString("utf-8"));
      const origin = new URL(config.vpn.subPublicBaseUrl).origin;
      decoded.Geoipurl = `${origin}/api/v1/vpn/geoip.dat`;
      decoded.Geositeurl = `${origin}/api/v1/vpn/geosite.dat`;
      headers.set("routing", `${prefix}${Buffer.from(JSON.stringify(decoded), "utf-8").toString("base64")}`);
    } catch (error) {
      logger.warn({ err: error }, "vpnService: не удалось переписать Geoipurl/Geositeurl в Routing-заголовке");
    }
  }

  /** Email в панели уникален (там уже 130+ клиентов, часть заведена вручную задолго
   * до этой фичи) — проверяем СВОБОДЕН ли конкретный email именно в панели (не
   * только в нашей локальной таблице), иначе могли бы затереть чужой существующий
   * профиль с тем же "и.фамилия". */
  private async findFreePanelEmail(baseEmail: string): Promise<string> {
    let candidate = baseEmail;
    let suffix = 1;
    while (await vpnPanelService.getByEmail(candidate)) {
      suffix += 1;
      candidate = `${baseEmail}${suffix}`;
    }
    return candidate;
  }

  /** Точка входа из бота — тот же принцип, что и appealService.assertActiveEmployee:
   * резолвим Telegram ID в активного сотрудника, дальше работаем с ним. */
  async getAccessFromBot(telegramId: bigint): Promise<VpnAccessDTO> {
    const user = await userRepository.findByTelegramId(telegramId);
    if (!user || user.status !== "ACTIVE") {
      throw new ForbiddenError("VPN доступен только подтверждённым сотрудникам");
    }
    return this.getOrCreateProfile({ id: user.id, fullName: user.fullName, telegramId: user.telegramId! });
  }

  async getOrCreateProfile(user: { id: string; fullName: string; telegramId: bigint }): Promise<VpnAccessDTO> {
    const existing = await vpnProfileRepository.findActiveByUserId(user.id);
    if (existing) {
      // Профиль считается активным локально, но панель могла смениться (как при
      // миграции сервера 2026-09-23) — тогда клиент на НОВОЙ панели не существует,
      // и старая ссылка подписки мертва навсегда. Проверяем перед тем, как отдать
      // ту же ссылку повторно; если клиента на панели нет — тихо самовосстанавливаемся
      // (отзываем локально и создаём заново), вместо того чтобы годами отдавать
      // сотруднику неработающую ссылку.
      const stillOnPanel = await vpnPanelService.getByEmail(existing.panelEmail);
      if (stillOnPanel) {
        return { subscriptionUrl: this.getSubscriptionUrl(existing.subId), alreadyExisted: true };
      }
      logger.warn(
        { userId: user.id, panelEmail: existing.panelEmail },
        "vpnService: локальный профиль есть, но на панели клиента не нашли (сменился сервер?) — пересоздаём",
      );
      await vpnProfileRepository.revoke(existing.id);
    }

    const baseEmail = transliterateToLogin(user.fullName);
    const panelEmail = await this.findFreePanelEmail(baseEmail);

    const { subId } = await vpnPanelService.createClient({
      email: panelEmail,
      tgId: Number(user.telegramId),
      limitHwid: VPN_PROFILE_HWID_LIMIT,
      inboundIds: VPN_STANDARD_INBOUND_IDS,
    });

    await vpnProfileRepository.create({ userId: user.id, panelEmail, subId });

    return { subscriptionUrl: this.getSubscriptionUrl(subId), alreadyExisted: false };
  }

  /** Best-effort, тем же принципом, что и остальные вторичные внешние вызовы в этой
   * кодовой базе (см. leadService.forwardAttachmentsToBitrix) — сбой удаления в
   * панели не должен блокировать остальной процесс увольнения (userService.blockUser),
   * но и помечать профиль отозванным при неудаче нельзя: это скрыло бы то, что
   * доступ по факту ещё жив. Ошибка остаётся в логах для ручной проверки. */
  async revokeProfile(userId: string): Promise<void> {
    const profile = await vpnProfileRepository.findActiveByUserId(userId);
    if (!profile) return;

    try {
      await vpnPanelService.deleteClient(profile.panelEmail);
    } catch (error) {
      logger.error(
        { err: error, userId, panelEmail: profile.panelEmail },
        "vpnService: не удалось удалить VPN-профиль при увольнении — требуется ручная проверка",
      );
      return;
    }

    await vpnProfileRepository.revoke(profile.id);
  }
}

export const vpnService = new VpnService();
