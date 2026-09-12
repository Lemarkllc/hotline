-- CreateTable
CREATE TABLE "bitrix_lead_alerts" (
    "id" TEXT NOT NULL,
    "bitrixLeadId" TEXT NOT NULL,
    "statusId" TEXT NOT NULL,
    "alertedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bitrix_lead_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bitrix_lead_alerts_bitrixLeadId_statusId_key" ON "bitrix_lead_alerts"("bitrixLeadId", "statusId");
