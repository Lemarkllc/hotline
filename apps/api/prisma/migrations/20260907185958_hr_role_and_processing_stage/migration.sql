-- AlterTable
ALTER TABLE "appeal_attachments" ADD COLUMN     "vacationRequestId" TEXT;

-- AlterTable
ALTER TABLE "appeals" ADD COLUMN     "certificatesIssued" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "processedAt" TIMESTAMP(3),
ADD COLUMN     "processedById" TEXT,
ADD COLUMN     "terminationApplicationSigned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "terminationOrderSigned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "walkoffSheetSigned" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "vacation_requests" ADD COLUMN     "applicationDrafted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "applicationSigned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "processedAt" TIMESTAMP(3),
ADD COLUMN     "processedById" TEXT;

-- CreateIndex
CREATE INDEX "appeal_attachments_vacationRequestId_idx" ON "appeal_attachments"("vacationRequestId");

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeal_attachments" ADD CONSTRAINT "appeal_attachments_vacationRequestId_fkey" FOREIGN KEY ("vacationRequestId") REFERENCES "vacation_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacation_requests" ADD CONSTRAINT "vacation_requests_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
