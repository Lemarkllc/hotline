-- AlterTable
ALTER TABLE "appeal_messages" ADD COLUMN     "authorId" TEXT;

-- AddForeignKey
ALTER TABLE "appeal_messages" ADD CONSTRAINT "appeal_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
