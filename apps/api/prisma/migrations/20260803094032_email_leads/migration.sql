-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'CONVERTED', 'STOP_LISTED');

-- CreateTable
CREATE TABLE "email_leads" (
    "id" TEXT NOT NULL,
    "publicNumber" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "extractedPhone" TEXT,
    "subject" TEXT NOT NULL,
    "originalBody" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "bitrixLeadId" TEXT,
    "convertedByUserId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "stopListedByUserId" TEXT,
    "stopListedAt" TIMESTAMP(3),
    "stopListReason" TEXT,
    "confirmationEmailSentAt" TIMESTAMP(3),
    "confirmationEmailError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_lead_messages" (
    "id" TEXT NOT NULL,
    "emailLeadId" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_lead_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_blocklist_entries" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_blocklist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_leads_publicNumber_key" ON "email_leads"("publicNumber");

-- CreateIndex
CREATE INDEX "email_leads_fromEmail_status_idx" ON "email_leads"("fromEmail", "status");

-- CreateIndex
CREATE UNIQUE INDEX "email_blocklist_entries_email_key" ON "email_blocklist_entries"("email");

-- AddForeignKey
ALTER TABLE "email_lead_messages" ADD CONSTRAINT "email_lead_messages_emailLeadId_fkey" FOREIGN KEY ("emailLeadId") REFERENCES "email_leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
