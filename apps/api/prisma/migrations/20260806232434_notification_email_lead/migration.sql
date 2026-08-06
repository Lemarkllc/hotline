-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "emailLeadId" TEXT;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_emailLeadId_fkey" FOREIGN KEY ("emailLeadId") REFERENCES "email_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
