-- CreateTable
CREATE TABLE "bitrix_lead_sla_events" (
    "id" TEXT NOT NULL,
    "bitrixLeadId" TEXT NOT NULL,
    "statusId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bitrix_lead_sla_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bitrix_lead_snapshots" (
    "bitrixLeadId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "dateCreate" TIMESTAMP(3) NOT NULL,
    "currentStatusId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bitrix_lead_snapshots_pkey" PRIMARY KEY ("bitrixLeadId")
);

-- CreateIndex
CREATE INDEX "bitrix_lead_sla_events_assignedById_occurredAt_idx" ON "bitrix_lead_sla_events"("assignedById", "occurredAt");

-- CreateIndex
CREATE INDEX "bitrix_lead_snapshots_assignedById_dateCreate_idx" ON "bitrix_lead_snapshots"("assignedById", "dateCreate");
