import { config } from "@/config/unifiedConfig.js";
import { logger } from "@/lib/logger.js";
import { VPN_PROFILE_HWID_LIMIT, VPN_PROFILE_IP_LIMIT, VPN_STANDARD_INBOUND_IDS } from "@/config/vpnConfig.js";
import { vpnPanelService } from "@/services/vpnPanelService.js";
import { vpnProfileRepository } from "@/repositories/VpnProfileRepository.js";
import { userRepository } from "@/repositories/UserRepository.js";
import { transliterateToLogin } from "@/utils/transliterate.js";
import { ForbiddenError, ValidationError } from "@/types/index.js";

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
export class VpnService {
  getSubscriptionUrl(subId: string): string {
    return `${config.vpn.subBaseUrl}${subId}`;
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
      return { subscriptionUrl: this.getSubscriptionUrl(existing.subId), alreadyExisted: true };
    }

    const baseEmail = transliterateToLogin(user.fullName);
    const panelEmail = await this.findFreePanelEmail(baseEmail);

    await vpnPanelService.createClient({
      email: panelEmail,
      tgId: Number(user.telegramId),
      limitIp: VPN_PROFILE_IP_LIMIT,
      limitHwid: VPN_PROFILE_HWID_LIMIT,
      inboundIds: VPN_STANDARD_INBOUND_IDS,
    });

    // /clients/add не возвращает сгенерированный subId — забираем отдельным вызовом
    // сразу после (см. vpnPanelService.createClient).
    const client = await vpnPanelService.getByEmail(panelEmail);
    if (!client) {
      throw new ValidationError(
        "VPN-профиль создан в панели, но не удалось получить ссылку — обратитесь к администратору",
      );
    }

    await vpnProfileRepository.create({ userId: user.id, panelEmail, subId: client.subId });

    return { subscriptionUrl: this.getSubscriptionUrl(client.subId), alreadyExisted: false };
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
