-- CreateEnum
CREATE TYPE "EmailLeadMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- AlterTable
ALTER TABLE "email_lead_messages" ADD COLUMN     "direction" "EmailLeadMessageDirection" NOT NULL DEFAULT 'INBOUND',
ADD COLUMN     "sentByUserId" TEXT;

-- AlterTable
ALTER TABLE "email_leads" ADD COLUMN     "assigneeId" TEXT;

-- AddForeignKey
ALTER TABLE "email_leads" ADD CONSTRAINT "email_leads_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_lead_messages" ADD CONSTRAINT "email_lead_messages_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
