/**
 * Разовый бэкфилл AmneziaWG для уже выданных VPN-профилей (openspec-изменение
 * vpn-incy-amneziawg-split): основному клиенту на панели добавляется AmneziaWG-inbound
 * (ключ слота 1), и создаётся вспомогательный клиент слота 2 ("<panelEmail>-AWG2").
 * Новые профили получают то же самое сразу (vpnService.getOrCreateProfile).
 *
 * Массовыми вызовами панели (bulkAttach/bulkCreate) — каждый перезапускает Xray один
 * раз, а не на каждого сотрудника (иначе десятки обрывов соединений у всех).
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
import { VPN_AWG_INBOUND_ID } from "@/config/vpnConfig.js";
import { vpnProfileRepository } from "@/repositories/VpnProfileRepository.js";
import { generateSubId, vpnPanelService } from "@/services/vpnPanelService.js";

const dryRun = process.argv.includes("--dry-run");
const AUX_COMMENT = "HotLine: AmneziaWG слот 2, скрытый — не выдавать сотруднику";

async function main(): Promise<void> {
  const profiles = await vpnProfileRepository.findAllActive();
  const toAttach: string[] = [];
  const toCreate: { profileId: string; email: string; subId: string; tgId: number }[] = [];
  let missingOnPanel = 0;

  for (const profile of profiles) {
    const main = await vpnPanelService.getByEmail(profile.panelEmail);
    if (!main) {
      missingOnPanel++;
      console.log(`[нет на панели] ${profile.panelEmail} — пропуск (самовосстановится при следующем «Получить VPN»)`);
      continue;
    }
    if (!main.inboundIds.includes(VPN_AWG_INBOUND_ID)) toAttach.push(profile.panelEmail);
    if (!profile.awgAuxSubId) {
      toCreate.push({
        profileId: profile.id,
        email: `${profile.panelEmail}-AWG2`,
        subId: generateSubId(),
        tgId: Number(profile.user.telegramId ?? main.tgId ?? 0),
      });
    }
  }

  console.log(`${dryRun ? "[dry-run] " : ""}профилей: ${profiles.length}, нет на панели: ${missingOnPanel}, привязать AmneziaWG: ${toAttach.length}, создать -AWG2: ${toCreate.length}`);
  if (dryRun) return;

  if (toAttach.length > 0) {
    const result = await vpnPanelService.bulkAttach(toAttach, [VPN_AWG_INBOUND_ID]);
    console.log(`bulkAttach: привязано ${result.attached.length}, пропущено ${result.skipped.length}, ошибок ${result.errors.length}`);
    for (const error of result.errors) console.error("[ошибка attach]", error);
  }

  if (toCreate.length > 0) {
    const result = await vpnPanelService.bulkCreate(
      toCreate.map((c) => ({ email: c.email, subId: c.subId, tgId: c.tgId, limitHwid: 0, comment: AUX_COMMENT, inboundIds: [VPN_AWG_INBOUND_ID] })),
    );
    console.log(`bulkCreate: создано ${result.created}, пропущено ${result.skipped.length}`);
    const skipped = new Map(result.skipped.map((s) => [s.email, s.reason]));

    let saved = 0;
    for (const item of toCreate) {
      // Уже существовал на панели (прошлый прерванный запуск) — берём его настоящий subId.
      const subId = skipped.has(item.email) ? (await vpnPanelService.getByEmail(item.email))?.subId : item.subId;
      if (!subId) {
        console.error(`[ошибка] ${item.email}: ${skipped.get(item.email) ?? "не создан"}`);
        continue;
      }
      await vpnProfileRepository.setAwgAux(item.profileId, item.email, subId);
      saved++;
    }
    console.log(`-AWG2 сохранено в профилях: ${saved} из ${toCreate.length}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
