-- AlterTable
ALTER TABLE "appeals" ADD COLUMN     "invitedAt" TIMESTAMP(3),
ADD COLUMN     "invitedById" TEXT;

-- AlterTable
ALTER TABLE "bitrix_lead_snapshots" ALTER COLUMN "sourceId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "vacation_requests" ADD COLUMN     "invitedAt" TIMESTAMP(3),
ADD COLUMN     "invitedById" TEXT;

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacation_requests" ADD CONSTRAINT "vacation_requests_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
