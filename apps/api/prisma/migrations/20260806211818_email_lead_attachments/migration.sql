-- CreateTable
CREATE TABLE "email_lead_attachments" (
    "id" TEXT NOT NULL,
    "emailLeadMessageId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_lead_attachments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "email_lead_attachments" ADD CONSTRAINT "email_lead_attachments_emailLeadMessageId_fkey" FOREIGN KEY ("emailLeadMessageId") REFERENCES "email_lead_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
