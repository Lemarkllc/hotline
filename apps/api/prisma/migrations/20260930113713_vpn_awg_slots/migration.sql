-- AlterTable
ALTER TABLE "vpn_profiles" ADD COLUMN     "awgAuxPanelEmail" TEXT,
ADD COLUMN     "awgAuxSubId" TEXT;

-- CreateTable
CREATE TABLE "vpn_awg_slots" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "hwidHash" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vpn_awg_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vpn_awg_slots_profileId_slot_key" ON "vpn_awg_slots"("profileId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "vpn_awg_slots_profileId_hwidHash_key" ON "vpn_awg_slots"("profileId", "hwidHash");

-- AddForeignKey
ALTER TABLE "vpn_awg_slots" ADD CONSTRAINT "vpn_awg_slots_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "vpn_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
