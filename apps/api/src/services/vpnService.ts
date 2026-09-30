import { config } from "@/config/unifiedConfig.js";
import { logger } from "@/lib/logger.js";
import { VPN_AWG_INBOUND_ID, VPN_PROFILE_HWID_LIMIT, VPN_STANDARD_INBOUND_IDS } from "@/config/vpnConfig.js";
import { vpnAwgSlotRepository } from "@/repositories/VpnAwgSlotRepository.js";
import { vpnPanelService } from "@/services/vpnPanelService.js";
import { vpnProfileRepository } from "@/repositories/VpnProfileRepository.js";
import { userRepository } from "@/repositories/UserRepository.js";
import { transliterateToLogin } from "@/utils/transliterate.js";
import { rewriteHappRoutingHeader } from "@/utils/happRouting.js";
import { applyAllowedIps } from "@/utils/awgAllowedIps.js";
import {
  appendAmneziaWgElement,
  buildAmneziaWgServers,
  extractAmneziaWgConfigs,
  isIncyUserAgent,
} from "@/utils/amneziaWgSubscription.js";
import { AwgUnavailableError, vpnAwgSlotService } from "@/services/vpnAwgSlotService.js";
import { vpnAwgRoutingService } from "@/services/vpnAwgRoutingService.js";
import { ForbiddenError } from "@/types/index.js";
import type { VpnProfile } from "@prisma/client";

export interface VpnAccessDTO {
  subscriptionUrl: string;
  /** true — у сотрудника уже был профиль, показываем ту же ссылку заново (решение
   * пользователя 2026-09-22: повторное "Получить VPN" не создаёт второй профиль). */
  alreadyExisted: boolean;
}

/**
 * «Получить VPN» (боковое меню бота-сотрудника) — создаёт персональный профиль на
 * 3X-UI (vpnPanelService), даёт ссылку подписки. Отзыв — при увольнении
 * (userService.blockUser вызывает revokeProfile) — вместе с вспомогательным
 * AmneziaWG-клиентом слота 2. Для INCY подписка дополняется AmneziaWG с
 * раздельной маршрутизацией (withAmneziaWg, флаг VPN_AWG_ENABLED).
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
    let body = await upstreamRes.arrayBuffer();
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

        if (config.vpn.awgEnabled && isIncyUserAgent(incomingUserAgent)) {
          body = await this.withAmneziaWg(body, profile, incomingHwid);
        }
      }
      this.rewriteRoutingHeader(headers);
    }

    return { status: upstreamRes.status, headers, body };
  }

  /** AmneziaWG для INCY (openspec vpn-incy-amneziawg-split): панель кладёт его только
   * в сырой список ссылок, не в JSON — берём конфиг слота этого устройства, ставим
   * AllowedIPs «RU напрямую» и дописываем элементом {"type":"amneziawg"} в JSON-массив.
   * Слот выделяется здесь, уже ПОСЛЕ успешного ответа панели на основной запрос, —
   * значит, лимит устройств панель для этого X-HWID уже проверила.
   * Опционально: любой сбой — лог (без HWID и ключей) и подписка как пришла от панели,
   * без AmneziaWG; полнотуннельный конфиг без split-routing не выдаётся никогда. */
  private async withAmneziaWg(body: ArrayBuffer, profile: VpnProfile, hwid: string | undefined): Promise<ArrayBuffer> {
    try {
      const json: unknown = JSON.parse(Buffer.from(body).toString("utf-8"));
      const slot = await vpnAwgSlotService.assignSlot(profile.id, hwid, VPN_PROFILE_HWID_LIMIT);
      const slotSubId = slot === 1 ? profile.subId : slot === 2 ? profile.awgAuxSubId : null;
      if (!slotSubId) throw new AwgUnavailableError(`слот ${slot}: вспомогательный клиент ещё не создан`);

      // X-HWID нужен только основному клиенту (слот 1, под лимитом устройств).
      const raw = await vpnPanelService.fetchRawSubscription(slotSubId, slot === 1 ? hwid : undefined);
      const configs = extractAmneziaWgConfigs(raw);
      if (configs.length === 0) throw new AwgUnavailableError(`слот ${slot}: в подписке нет AmneziaWG`);

      const allowedIps = await vpnAwgRoutingService.getAllowedIps();
      const servers = buildAmneziaWgServers(configs.map((c) => ({ name: c.name, conf: applyAllowedIps(c.conf, allowedIps) })));
      const merged = Buffer.from(JSON.stringify(appendAmneziaWgElement(json, servers)), "utf-8");
      return merged.buffer.slice(merged.byteOffset, merged.byteOffset + merged.byteLength) as ArrayBuffer;
    } catch (error) {
      logger.warn(
        { profileId: profile.id, reason: error instanceof Error ? error.message : String(error) },
        "vpnService: AmneziaWG для INCY не выдан, отдаём подписку без него",
      );
      return body;
    }
  }

  /** Routing-заголовок: add/ → onadd/ (профиль активируется, даже если у сотрудника
   * уже активен чужой) + Geoipurl/Geositeurl на наше зеркало — см. rewriteHappRoutingHeader.
   * Best-effort: неожиданный формат — оставляем как пришло от панели. */
  private rewriteRoutingHeader(headers: Headers): void {
    const routing = headers.get("routing");
    if (!routing) return;

    const rewritten = rewriteHappRoutingHeader(routing, new URL(config.vpn.subPublicBaseUrl).origin);
    if (rewritten) {
      headers.set("routing", rewritten);
    } else {
      logger.warn({ routingPrefix: routing.slice(0, 32) }, "vpnService: неожиданный формат Routing-заголовка, оставлен как есть");
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
      // Сверяем именно subId, не только email: реальный случай 2026-09-30 (Комлик В.) —
      // после миграции панели её логин "k.yurevna" занял другой сотрудник с тем же
      // инициалом и отчеством (см. transliterateToLogin до исправления), проверка
      // "email есть на панели" проходила по ЧУЖОМУ клиенту, и ей вечно отдавалась
      // мёртвая ссылка со старым UUID-subId.
      const onPanel = await vpnPanelService.getByEmail(existing.panelEmail);
      if (onPanel && onPanel.subId === existing.subId) {
        return { subscriptionUrl: this.getSubscriptionUrl(existing.subId), alreadyExisted: true };
      }
      logger.warn(
        { userId: user.id, panelEmail: existing.panelEmail, reason: onPanel ? "subId на панели другой (чужой клиент)" : "клиента на панели нет" },
        "vpnService: локальный профиль не совпадает с панелью (сменился сервер?) — пересоздаём",
      );
      // Только локально: клиент на панели либо отсутствует, либо принадлежит другому сотруднику.
      await vpnAwgSlotRepository.deleteAllForProfile(existing.id);
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

    const profile = await vpnProfileRepository.create({ userId: user.id, panelEmail, subId });
    await this.ensureAwgAuxClient(profile, Number(user.telegramId));

    return { subscriptionUrl: this.getSubscriptionUrl(subId), alreadyExisted: false };
  }

  /** Вспомогательный клиент слота 2 AmneziaWG ("<panelEmail>-AWG2", см. VpnProfile.awgAuxSubId):
   * второе устройство сотрудника не может делить WireGuard-ключ с первым. Только
   * AmneziaWG-inbound, limitHwid 0 — его подписку запрашивает лишь наш сервер.
   * Best-effort: сбой не должен ломать выдачу VPN — без него просто не будет AmneziaWG
   * на втором устройстве, бэкфилл (scripts/backfillVpnAwg.ts) досоздаст. Возвращает
   * true, если клиент есть (уже был или создан). */
  async ensureAwgAuxClient(profile: VpnProfile, tgId: number): Promise<boolean> {
    if (profile.awgAuxSubId) return true;
    const auxEmail = `${profile.panelEmail}-AWG2`;
    try {
      const existing = await vpnPanelService.getByEmail(auxEmail);
      const auxSubId = existing
        ? existing.subId
        : (
            await vpnPanelService.createClient({
              email: auxEmail,
              tgId,
              limitHwid: 0,
              inboundIds: [VPN_AWG_INBOUND_ID],
              comment: "HotLine: AmneziaWG слот 2, скрытый — не выдавать сотруднику",
            })
          ).subId;
      await vpnProfileRepository.setAwgAux(profile.id, auxEmail, auxSubId);
      return true;
    } catch (error) {
      logger.error({ err: error, profileId: profile.id, auxEmail }, "vpnService: не удалось создать AmneziaWG-клиента слота 2");
      return false;
    }
  }

  /** Best-effort, тем же принципом, что и остальные вторичные внешние вызовы в этой
   * кодовой базе (см. leadService.forwardAttachmentsToBitrix) — сбой удаления в
   * панели не должен блокировать остальной процесс увольнения (userService.blockUser),
   * но и помечать профиль отозванным при неудаче нельзя: это скрыло бы то, что
   * доступ по факту ещё жив. Ошибка остаётся в логах для ручной проверки. */
  async revokeProfile(userId: string): Promise<void> {
    const profile = await vpnProfileRepository.findActiveByUserId(userId);
    if (!profile) return;

    // Удаляем на панели, только если основной клиент — действительно ЭТОГО профиля
    // (subId совпадает). Иначе профиль устаревший (панель сменилась, логин занял другой
    // сотрудник — см. getOrCreateProfile): удаление по email снесло бы VPN чужому
    // человеку, в том числе его -AWG2. Такой профиль отзываем только у себя.
    const onPanel = await vpnPanelService.getByEmail(profile.panelEmail);
    const ownsPanelClient = !!onPanel && onPanel.subId === profile.subId;
    if (onPanel && !ownsPanelClient) {
      logger.warn(
        { userId, panelEmail: profile.panelEmail },
        "vpnService: клиент панели с этим email принадлежит другому профилю — на панели ничего не удаляем",
      );
    }

    // Вспомогательный AmneziaWG-клиент (слот 2) — тоже рабочий ключ, удаляем первым:
    // иначе у уволенного остался бы доступ со второго устройства.
    const emails = ownsPanelClient ? [profile.awgAuxPanelEmail, profile.panelEmail].filter((e): e is string => !!e) : [];
    for (const panelEmail of emails) {
      try {
        await vpnPanelService.deleteClient(panelEmail);
      } catch (error) {
        // Клиента на панели уже нет (удалён руками, сменилась панель) — цель достигнута.
        if (!(await vpnPanelService.getByEmail(panelEmail))) continue;
        logger.error(
          { err: error, userId, panelEmail },
          "vpnService: не удалось удалить VPN-профиль при увольнении — требуется ручная проверка",
        );
        return;
      }
    }

    await vpnAwgSlotRepository.deleteAllForProfile(profile.id);
    await vpnProfileRepository.revoke(profile.id);
  }
}

export const vpnService = new VpnService();
