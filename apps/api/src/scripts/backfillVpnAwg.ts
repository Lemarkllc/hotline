/**
 * Разовый бэкфилл AmneziaWG для уже выданных VPN-профилей (openspec-изменение
 * vpn-incy-amneziawg-split): основному клиенту на панели добавляется AmneziaWG-inbound
 * (ключ слота 1), и создаётся вспомогательный клиент слота 2 ("<panelEmail>-AWG2").
 * Новые профили получают то же самое сразу (vpnService.getOrCreateProfile).
 *
 * Массовыми вызовами панели (bulkAttach/bulkCreate) — каждый перезапускает Xray один
 * раз, а не на каждого сотрудника (иначе десятки обрывов соединений у всех).
 *
 * Второй проход (openspec admin-vpn-management): лимит устройств с панели (limitHwid)
 * записывается в VpnProfile.deviceLimit, и для лимитов > 2 досоздаются
 * вспомогательные клиенты -AWG3…-AWG5 (vpnService.syncAwgAuxClients). У кого лимит 2 —
 * ничего не меняется.
 *
 * Идемпотентен: уже привязанный inbound и уже созданный вспомогательный клиент
 * пропускаются, повторный запуск ничего не меняет. Ссылка подписки сотрудника не меняется.
 *
 * Запуск (из apps/api, с боевым .env):
 *   pnpm exec tsx src/scripts/backfillVpnAwg.ts --dry-run   # только показать, что будет сделано
 *   pnpm exec tsx src/scripts/backfillVpnAwg.ts             # применить
 * На сервере: docker exec hotline-api-1 node dist/scripts/backfillVpnAwg.js [--dry-run]
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma.js";
import { VPN_AWG_INBOUND_IDS, VPN_AWG_MAX_SLOTS, VPN_MAX_DEVICE_LIMIT } from "@/config/vpnConfig.js";
import { vpnProfileRepository } from "@/repositories/VpnProfileRepository.js";
import { vpnPanelService } from "@/services/vpnPanelService.js";
import { vpnService } from "@/services/vpnService.js";
import { awgSlotCount, planAwgAuxSync } from "@/utils/awgSlotChoice.js";

const dryRun = process.argv.includes("--dry-run");

async function main(): Promise<void> {
  const profiles = await vpnProfileRepository.findAllActive();
  const toAttach = new Map<number, string[]>(VPN_AWG_INBOUND_IDS.map((id) => [id, []]));
  const toSync: { profile: (typeof profiles)[number]; deviceLimit: number; tgId: number }[] = [];
  let missingOnPanel = 0;

  for (const profile of profiles) {
    const main = await vpnPanelService.getByEmail(profile.panelEmail);
    if (!main || main.subId !== profile.subId) {
      missingOnPanel++;
      console.log(`[нет на панели] ${profile.panelEmail} — пропуск (самовосстановится при следующем «Получить VPN»)`);
      continue;
    }
    for (const id of VPN_AWG_INBOUND_IDS) if (!main.inboundIds.includes(id)) toAttach.get(id)!.push(profile.panelEmail);

    // limitHwid 0 на панели = без ограничения — у нас это потолок (5).
    const deviceLimit = main.limitHwid > 0 ? Math.min(main.limitHwid, VPN_MAX_DEVICE_LIMIT) : VPN_MAX_DEVICE_LIMIT;
    const plan = planAwgAuxSync(
      profile.awgAuxClients.map((a) => a.slot),
      awgSlotCount(deviceLimit, VPN_AWG_MAX_SLOTS),
    );
    if (deviceLimit !== profile.deviceLimit || plan.create.length > 0 || plan.remove.length > 0) {
      console.log(
        `${profile.panelEmail}: лимит ${profile.deviceLimit} → ${deviceLimit} (панель ${main.limitHwid}), создать слоты [${plan.create.join(", ")}], удалить [${plan.remove.join(", ")}]`,
      );
      toSync.push({ profile, deviceLimit, tgId: Number(profile.user.telegramId ?? main.tgId ?? 0) });
    }
  }

  const attachSummary = [...toAttach].map(([id, emails]) => `${id}: ${emails.length}`).join(", ");
  console.log(
    `${dryRun ? "[dry-run] " : ""}профилей: ${profiles.length}, нет на панели: ${missingOnPanel}, привязать AmneziaWG (${attachSummary}), изменить лимит/ключи: ${toSync.length}`,
  );
  if (dryRun) return;

  for (const [id, emails] of toAttach) {
    if (emails.length === 0) continue;
    const result = await vpnPanelService.bulkAttach(emails, [id]);
    console.log(`bulkAttach ${id}: привязано ${result.attached.length}, пропущено ${result.skipped.length}, ошибок ${result.errors.length}`);
    for (const error of result.errors) console.error("[ошибка attach]", error);
  }

  let synced = 0;
  for (const item of toSync) {
    try {
      const updated = await vpnProfileRepository.setDeviceLimit(item.profile.id, item.deviceLimit);
      await vpnService.syncAwgAuxClients(updated, item.tgId);
      synced++;
    } catch (error) {
      console.error(`[ошибка] ${item.profile.panelEmail}:`, error instanceof Error ? error.message : error);
    }
  }
  console.log(`лимит/ключи обновлены: ${synced} из ${toSync.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
