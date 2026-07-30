-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "externalContactId" TEXT;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_externalContactId_fkey" FOREIGN KEY ("externalContactId") REFERENCES "external_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
