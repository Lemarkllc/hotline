/**
 * Разовый бэкфилл AmneziaWG для уже выданных VPN-профилей (openspec-изменение
 * vpn-incy-amneziawg-split): основному клиенту на панели добавляется AmneziaWG-inbound
 * (ключ слота 1), и создаётся вспомогательный клиент слота 2 ("<panelEmail>-AWG2").
 * Новые профили получают то же самое сразу (vpnService.getOrCreateProfile).
 *
 * Идемпотентен: уже привязанный inbound и уже созданный вспомогательный клиент
 * пропускаются, повторный запуск ничего не меняет. Ссылка подписки сотрудника не меняется.
 *
 * Запуск (из apps/api, с боевым .env):
 *   pnpm exec tsx src/scripts/backfillVpnAwg.ts --dry-run   # только показать, что будет сделано
 *   pnpm exec tsx src/scripts/backfillVpnAwg.ts             # применить
 * На сервере после сборки: node dist/scripts/backfillVpnAwg.js [--dry-run]
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma.js";
import { VPN_AWG_INBOUND_ID } from "@/config/vpnConfig.js";
import { vpnProfileRepository } from "@/repositories/VpnProfileRepository.js";
import { vpnPanelService } from "@/services/vpnPanelService.js";
import { vpnService } from "@/services/vpnService.js";

const dryRun = process.argv.includes("--dry-run");

async function main(): Promise<void> {
  const profiles = await vpnProfileRepository.findAllActive();
  const summary = { total: profiles.length, attached: 0, auxCreated: 0, alreadyDone: 0, missingOnPanel: 0, failed: 0 };

  for (const profile of profiles) {
    const main = await vpnPanelService.getByEmail(profile.panelEmail);
    if (!main) {
      summary.missingOnPanel++;
      console.log(`[нет на панели] ${profile.panelEmail} — пропуск (самовосстановится при следующем «Получить VPN»)`);
      continue;
    }

    const needsAttach = !main.inboundIds.includes(VPN_AWG_INBOUND_ID);
    const needsAux = !profile.awgAuxSubId;
    if (!needsAttach && !needsAux) {
      summary.alreadyDone++;
      continue;
    }
    console.log(`${dryRun ? "[dry-run] " : ""}${profile.panelEmail}: ${needsAttach ? "привязать AmneziaWG " : ""}${needsAux ? "создать -AWG2" : ""}`);
    if (dryRun) {
      if (needsAttach) summary.attached++;
      if (needsAux) summary.auxCreated++;
      continue;
    }

    try {
      if (needsAttach) {
        await vpnPanelService.attachInbounds(profile.panelEmail, [VPN_AWG_INBOUND_ID]);
        summary.attached++;
      }
      if (needsAux) {
        const tgId = Number(profile.user.telegramId ?? main.tgId ?? 0);
        if (!(await vpnService.ensureAwgAuxClient(profile, tgId))) throw new Error("не удалось создать -AWG2 (см. лог выше)");
        summary.auxCreated++;
      }
    } catch (error) {
      summary.failed++;
      console.error(`[ошибка] ${profile.panelEmail}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`${dryRun ? "[dry-run] " : ""}итог:`, summary);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
