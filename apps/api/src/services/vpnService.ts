import { config } from "@/config/unifiedConfig.js";
import { logger } from "@/lib/logger.js";
import {
  VPN_AWG_INBOUND_IDS,
  VPN_AWG_MAX_SLOTS,
  VPN_AWG_PERSISTENT_KEEPALIVE_SEC,
  VPN_PROFILE_HWID_LIMIT,
  VPN_STANDARD_INBOUND_IDS,
} from "@/config/vpnConfig.js";
import { vpnAwgAuxClientRepository } from "@/repositories/VpnAwgAuxClientRepository.js";
import { awgSlotCount, planAwgAuxSync } from "@/utils/awgSlotChoice.js";
import { vpnAwgSlotRepository } from "@/repositories/VpnAwgSlotRepository.js";
import { generateSubId, MERGE_FETCHER_UA, vpnPanelService, type VpnPanelClientDTO, type VpnPanelDeviceDTO } from "@/services/vpnPanelService.js";
import { vpnProfileRepository } from "@/repositories/VpnProfileRepository.js";
import { userRepository } from "@/repositories/UserRepository.js";
import { transliterateToLogin } from "@/utils/transliterate.js";
import { rewriteHappRoutingHeader } from "@/utils/happRouting.js";
import { applyAllowedIps, ensurePersistentKeepalive } from "@/utils/awgAllowedIps.js";
import {
  appendAmneziaWgElement,
  buildAmneziaWgServers,
  extractAmneziaWgConfigs,
  isIncyUserAgent,
} from "@/utils/amneziaWgSubscription.js";
import { AwgUnavailableError, vpnAwgSlotService } from "@/services/vpnAwgSlotService.js";
import { vpnAwgRoutingService } from "@/services/vpnAwgRoutingService.js";
import { ForbiddenError, HttpError, NotFoundError } from "@/types/index.js";
import { selectStaleDevices } from "@/utils/vpnStaleDevices.js";
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
 * (userService.blockUser вызывает revokeProfile), перевыпуске и отключении
 * Администратором (revokeProfileOrThrow) — вместе со всеми вспомогательными
 * AmneziaWG-клиентами слотов 2…5. Для INCY подписка дополняется AmneziaWG с
 * раздельной маршрутизацией (withAmneziaWg, флаг VPN_AWG_ENABLED).
 */
/** Ответ upstream-панели на /sub/<subId>, который проксируем как есть, кроме
 * Profile-Title (см. VpnService.proxySubscription). */
export interface VpnSubscriptionProxyResult {
  status: number;
  headers: Headers;
  body: ArrayBuffer;
}

/** Устройство подписки для бота — без fingerprint и прочих внутренностей панели. */
export interface VpnDeviceView {
  id: number;
  app: string;
  os: string | null;
  model: string | null;
  lastSeen: string;
}

export interface VpnDevicesDTO {
  /** null — без ограничения (limitHwid 0 на панели). */
  limit: number | null;
  devices: VpnDeviceView[];
}

/** "INCY/2.6.2/ios …" → "INCY"; служебный "HotLineMergeFetcher (INCY/2.6.2/…)" → "INCY". */
function appName(userAgent: string | undefined): string {
  let ua = (userAgent ?? "").trim();
  const wrapped = ua.match(new RegExp(`^${MERGE_FETCHER_UA} \\((.+)\\)$`));
  if (wrapped) ua = wrapped[1]!;
  return ua.split("/")[0]?.trim() || "Неизвестное приложение";
}

export function toDeviceView(d: VpnPanelDeviceDTO): VpnDeviceView {
  const os = [d.deviceOs, d.osVersion].filter(Boolean).join(" ") || null;
  return {
    id: d.id,
    app: appName(d.userAgent),
    os,
    model: d.deviceModel || null,
    lastSeen: new Date(d.lastSeen).toISOString(),
  };
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
    incomingDeviceHeaders: Record<string, string> = {},
  ): Promise<VpnSubscriptionProxyResult> {
    const upstreamUrl = `${config.vpn.subBaseUrl.replace(/\/$/, "")}/${subId}`;
    // X-Device-OS/X-Ver-OS/X-Device-Model панель сохраняет вместе с HWID — без них в
    // «Мои устройства VPN» (бот) было бы видно только название приложения.
    const upstreamHeaders: Record<string, string> = { ...incomingDeviceHeaders };
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
          body = await this.withAmneziaWg(body, profile, incomingHwid, incomingUserAgent, incomingDeviceHeaders);
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
  private async withAmneziaWg(
    body: ArrayBuffer,
    profile: VpnProfile,
    hwid: string | undefined,
    appUserAgent: string | undefined,
    deviceHeaders: Record<string, string>,
  ): Promise<ArrayBuffer> {
    try {
      const json: unknown = JSON.parse(Buffer.from(body).toString("utf-8"));
      const slot = await vpnAwgSlotService.assignSlot(profile.id, hwid, awgSlotCount(profile.deviceLimit, VPN_AWG_MAX_SLOTS));
      const slotSubId = slot === 1 ? profile.subId : (await vpnAwgAuxClientRepository.findBySlot(profile.id, slot))?.subId;
      if (!slotSubId) throw new AwgUnavailableError(`слот ${slot}: вспомогательный клиент ещё не создан`);

      // X-HWID нужен только основному клиенту (слот 1, под лимитом устройств).
      const raw = await vpnPanelService.fetchRawSubscription(
        slotSubId,
        slot === 1 && hwid ? { hwid, appUserAgent, headers: deviceHeaders } : undefined,
      );
      const configs = extractAmneziaWgConfigs(raw);
      if (configs.length === 0) throw new AwgUnavailableError(`слот ${slot}: в подписке нет AmneziaWG`);

      const allowedIps = await vpnAwgRoutingService.getAllowedIps();
      const servers = buildAmneziaWgServers(configs.map((c) => ({ name: c.name, conf: ensurePersistentKeepalive(applyAllowedIps(c.conf, allowedIps), VPN_AWG_PERSISTENT_KEEPALIVE_SEC) })));
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
    if (user.vpnDisabledAt) throw new ForbiddenError("VPN отключён администратором");
    return this.getOrCreateProfile({ id: user.id, fullName: user.fullName, telegramId: user.telegramId! });
  }

  /** deviceLimit — только для нового профиля (Администратор задаёт 1…5); у уже
   * выданного лимит меняется отдельно (setDeviceLimit). */
  async getOrCreateProfile(
    user: { id: string; fullName: string; telegramId: bigint },
    deviceLimit: number = VPN_PROFILE_HWID_LIMIT,
  ): Promise<VpnAccessDTO> {
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
      await vpnAwgAuxClientRepository.deleteAllForProfile(existing.id);
      await vpnProfileRepository.revoke(existing.id);
      // Лимит, заданный Администратором, переживает самовосстановление.
      deviceLimit = existing.deviceLimit;
    }

    const baseEmail = transliterateToLogin(user.fullName);
    const panelEmail = await this.findFreePanelEmail(baseEmail);

    const { subId } = await vpnPanelService.createClient({
      email: panelEmail,
      tgId: Number(user.telegramId),
      limitHwid: deviceLimit,
      inboundIds: VPN_STANDARD_INBOUND_IDS,
    });

    const profile = await vpnProfileRepository.create({ userId: user.id, panelEmail, subId, deviceLimit });
    // Best-effort: без вспомогательных клиентов VPN рабочий, просто у устройств 2…N не
    // будет AmneziaWG; бэкфилл (scripts/backfillVpnAwg.ts) или смена лимита досоздадут.
    try {
      await this.syncAwgAuxClients(profile, Number(user.telegramId));
    } catch (error) {
      logger.error({ err: error, profileId: profile.id }, "vpnService: не удалось создать вспомогательных AmneziaWG-клиентов");
    }

    return { subscriptionUrl: this.getSubscriptionUrl(subId), alreadyExisted: false };
  }

  /** Вспомогательные клиенты AmneziaWG "<panelEmail>-AWG<N>" для слотов 2…min(лимит, 5):
   * разные устройства сотрудника не могут делить один WireGuard-ключ. Только
   * AmneziaWG-inbound'ы, limitHwid 0 — их подписку запрашивает лишь наш сервер.
   * Недостающих создаёт одним bulkCreate (один перезапуск Xray), лишних удаляет с
   * панели вместе с их слотами. Клиент с нужным email уже на панели (прошлый сбой
   * между панелью и БД) — подхватывается, не создаётся второй раз. Сбой — исключение. */
  async syncAwgAuxClients(profile: Pick<VpnProfile, "id" | "panelEmail" | "deviceLimit">, tgId: number): Promise<void> {
    const slotCount = awgSlotCount(profile.deviceLimit, VPN_AWG_MAX_SLOTS);
    const existing = await vpnAwgAuxClientRepository.listByProfile(profile.id);
    const plan = planAwgAuxSync(
      existing.map((a) => a.slot),
      slotCount,
    );

    const toCreate: { slot: number; email: string; subId: string }[] = [];
    for (const slot of plan.create) {
      const email = `${profile.panelEmail}-AWG${slot}`;
      const onPanel = await vpnPanelService.getByEmail(email);
      if (onPanel) {
        await vpnAwgAuxClientRepository.create({ profileId: profile.id, slot, panelEmail: email, subId: onPanel.subId });
      } else {
        toCreate.push({ slot, email, subId: generateSubId() });
      }
    }
    if (toCreate.length > 0) {
      const result = await vpnPanelService.bulkCreate(
        toCreate.map((c) => ({
          email: c.email,
          subId: c.subId,
          tgId,
          limitHwid: 0,
          inboundIds: VPN_AWG_INBOUND_IDS,
          comment: `HotLine: AmneziaWG слот ${c.slot}, скрытый — не выдавать сотруднику`,
        })),
      );
      const skipped = new Set(result.skipped.map((x) => x.email));
      for (const c of toCreate) {
        if (skipped.has(c.email)) continue;
        await vpnAwgAuxClientRepository.create({ profileId: profile.id, slot: c.slot, panelEmail: c.email, subId: c.subId });
      }
      if (skipped.size > 0) {
        throw new HttpError(502, `VPN-панель не создала вспомогательных клиентов: ${[...skipped].join(", ")}`);
      }
    }

    for (const aux of existing.filter((a) => plan.remove.includes(a.slot))) {
      await this.deletePanelClient(aux.panelEmail);
      await vpnAwgAuxClientRepository.delete(aux.id);
    }
    if (plan.remove.length > 0) await vpnAwgSlotRepository.deleteAbove(profile.id, slotCount);
  }

  /** Удаление клиента панели; «его уже нет» (удалён руками, сменилась панель) — тоже успех. */
  private async deletePanelClient(panelEmail: string): Promise<void> {
    try {
      await vpnPanelService.deleteClient(panelEmail);
    } catch (error) {
      if (!(await vpnPanelService.getByEmail(panelEmail))) return;
      throw error;
    }
  }

  /** «Мои устройства VPN» в боте: устройства СВОЕЙ подписки. Профиль должен совпадать с
   * клиентом панели по subId (как в getOrCreateProfile) — иначе по email виден был бы
   * чужой клиент с тем же логином. */
  async listOwnDevices(telegramId: bigint): Promise<VpnDevicesDTO> {
    const { profile, panelClient } = await this.resolveOwnPanelClient(telegramId);
    const devices = await vpnPanelService.listDevices(profile.panelEmail);
    // Фактический лимит клиента на панели, а не общий VPN_PROFILE_HWID_LIMIT: его
    // поднимают отдельным сотрудникам (2026-10-02 — 5 устройств), 0 = без ограничения.
    return { limit: panelClient.limitHwid > 0 ? panelClient.limitHwid : null, devices: devices.map(toDeviceView) };
  }

  /** Удаляет устройство своей подписки — только если id есть в её текущем списке. */
  async deleteOwnDevice(telegramId: bigint, deviceId: number): Promise<void> {
    const { profile } = await this.resolveOwnPanelClient(telegramId);
    const devices = await vpnPanelService.listDevices(profile.panelEmail);
    if (!devices.some((d) => d.id === deviceId)) throw new NotFoundError("Устройство не найдено в вашей подписке");
    await vpnPanelService.deleteDevice(profile.panelEmail, deviceId);
  }

  private async resolveOwnPanelClient(telegramId: bigint): Promise<{ profile: VpnProfile; panelClient: VpnPanelClientDTO }> {
    const user = await userRepository.findByTelegramId(telegramId);
    if (!user || user.status !== "ACTIVE") throw new ForbiddenError("VPN доступен только подтверждённым сотрудникам");
    const profile = await vpnProfileRepository.findActiveByUserId(user.id);
    if (!profile) throw new NotFoundError("VPN ещё не выдан");
    const onPanel = await vpnPanelService.getByEmail(profile.panelEmail);
    if (!onPanel || onPanel.subId !== profile.subId) throw new NotFoundError("Подписка устарела — нажмите «Получить VPN»");
    return { profile, panelClient: onPanel };
  }

  /** Ежедневная автоочистка (server.ts): удаляет с панели устройства подписок бота,
   * не обновлявшие подписку дольше config.vpn.deviceStaleDays. Панель сама устройства
   * не забывает, и удалённое приложение навсегда занимало бы место под лимитом.
   * Только профили бота с совпадающим subId — клиентов, заведённых на панели вручную,
   * и чужих по логину не трогаем. Сбой по одному клиенту не останавливает остальных. */
  async cleanupStaleDevices(now = Date.now()): Promise<{ checked: number; removed: number; failed: number }> {
    const result = { checked: 0, removed: 0, failed: 0 };
    for (const profile of await vpnProfileRepository.findAllActive()) {
      try {
        const onPanel = await vpnPanelService.getByEmail(profile.panelEmail);
        if (!onPanel || onPanel.subId !== profile.subId) continue;
        result.checked++;
        const stale = selectStaleDevices(await vpnPanelService.listDevices(profile.panelEmail), config.vpn.deviceStaleDays, now);
        for (const device of stale) {
          await vpnPanelService.deleteDevice(profile.panelEmail, device.id);
          result.removed++;
        }
      } catch (error) {
        result.failed++;
        logger.error({ err: error, panelEmail: profile.panelEmail }, "vpnService: автоочистка устройств — сбой по клиенту");
      }
    }
    logger.info(result, "vpnService: автоочистка неактивных VPN-устройств");
    return result;
  }

  /** Увольнение (userService.blockUser): best-effort, тем же принципом, что и остальные
   * вторичные внешние вызовы в этой кодовой базе (см. leadService.forwardAttachmentsToBitrix) —
   * сбой удаления в панели не должен блокировать остальной процесс увольнения, но и
   * помечать профиль отозванным при неудаче нельзя: это скрыло бы то, что доступ по
   * факту ещё жив. Ошибка остаётся в логах для ручной проверки. */
  async revokeProfile(userId: string): Promise<void> {
    try {
      await this.revokeProfileOrThrow(userId);
    } catch {
      // Уже в логе (revokeProfileOrThrow).
    }
  }

  /** Отзыв — один путь для увольнения, перевыпуска и отключения Администратором.
   * Удаляет на панели основного и всех вспомогательных клиентов, слоты, помечает
   * профиль отозванным. Сбой удаления любого клиента — профиль не трогаем, ошибка
   * в лог и наверх (Администратор видит её, перевыпуск не создаёт новый профиль).
   * Возвращает false, если активного профиля не было. */
  async revokeProfileOrThrow(userId: string): Promise<boolean> {
    const profile = await vpnProfileRepository.findActiveByUserId(userId);
    if (!profile) return false;

    // Удаляем на панели, только если основной клиент — действительно ЭТОГО профиля
    // (subId совпадает). Иначе профиль устаревший (панель сменилась, логин занял другой
    // сотрудник — см. getOrCreateProfile): удаление по email снесло бы VPN чужому
    // человеку, в том числе его -AWG<N>. Такой профиль отзываем только у себя.
    const onPanel = await vpnPanelService.getByEmail(profile.panelEmail);
    const ownsPanelClient = !!onPanel && onPanel.subId === profile.subId;
    if (onPanel && !ownsPanelClient) {
      logger.warn(
        { userId, panelEmail: profile.panelEmail },
        "vpnService: клиент панели с этим email принадлежит другому профилю — на панели ничего не удаляем",
      );
    }

    // Вспомогательные AmneziaWG-клиенты — тоже рабочие ключи, удаляем первыми:
    // иначе у сотрудника остался бы доступ с устройств 2…N.
    if (ownsPanelClient) {
      const aux = await vpnAwgAuxClientRepository.listByProfile(profile.id);
      for (const panelEmail of [...aux.map((a) => a.panelEmail), profile.panelEmail]) {
        try {
          await this.deletePanelClient(panelEmail);
        } catch (error) {
          logger.error({ err: error, userId, panelEmail }, "vpnService: не удалось удалить VPN-профиль — требуется ручная проверка");
          throw new HttpError(502, `Не удалось удалить клиента VPN-панели ${panelEmail} — профиль не изменён`);
        }
      }
    }

    await vpnAwgSlotRepository.deleteAllForProfile(profile.id);
    await vpnAwgAuxClientRepository.deleteAllForProfile(profile.id);
    await vpnProfileRepository.revoke(profile.id);
    return true;
  }
}

export const vpnService = new VpnService();
