-- Раздел «VPN» для Администратора (openspec admin-vpn-management):
-- запрет VPN у сотрудника, лимит устройств в профиле, вспомогательные AWG-клиенты
-- слотов 2…5 отдельной таблицей, суточные снимки трафика.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "vpnDisabledAt" TIMESTAMP(3),
ADD COLUMN     "vpnDisabledById" TEXT;

-- AlterTable
ALTER TABLE "vpn_profiles" ADD COLUMN     "deviceLimit" INTEGER NOT NULL DEFAULT 2;

-- CreateTable
CREATE TABLE "vpn_awg_aux_clients" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "panelEmail" TEXT NOT NULL,
    "subId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vpn_awg_aux_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vpn_usage_snapshots" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "upBytes" BIGINT NOT NULL,
    "downBytes" BIGINT NOT NULL,
    "deviceCount" INTEGER NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vpn_usage_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vpn_awg_aux_clients_subId_key" ON "vpn_awg_aux_clients"("subId");

-- CreateIndex
CREATE UNIQUE INDEX "vpn_awg_aux_clients_profileId_slot_key" ON "vpn_awg_aux_clients"("profileId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "vpn_usage_snapshots_profileId_day_key" ON "vpn_usage_snapshots"("profileId", "day");

-- AddForeignKey
ALTER TABLE "vpn_awg_aux_clients" ADD CONSTRAINT "vpn_awg_aux_clients_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "vpn_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vpn_usage_snapshots" ADD CONSTRAINT "vpn_usage_snapshots_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "vpn_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Перенос существующего вспомогательного клиента (-AWG2) в слот 2 новой таблицы.
-- Только активные профили: у отозванных клиента на панели уже нет. Дубликаты subId
-- (несколько устаревших профилей с одним -AWG2 после бэкфилла 2026-09-30) — берём
-- самый новый профиль, остальные пропускаем.
INSERT INTO "vpn_awg_aux_clients" ("id", "profileId", "slot", "panelEmail", "subId", "createdAt")
SELECT DISTINCT ON ("awgAuxSubId") gen_random_uuid()::text, "id", 2, "awgAuxPanelEmail", "awgAuxSubId", CURRENT_TIMESTAMP
FROM "vpn_profiles"
WHERE "revokedAt" IS NULL AND "awgAuxSubId" IS NOT NULL AND "awgAuxPanelEmail" IS NOT NULL
ORDER BY "awgAuxSubId", "createdAt" DESC;

-- AlterTable
ALTER TABLE "vpn_profiles" DROP COLUMN "awgAuxPanelEmail",
DROP COLUMN "awgAuxSubId";
