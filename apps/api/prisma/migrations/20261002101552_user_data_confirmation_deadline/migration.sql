-- AlterTable
ALTER TABLE "users" ADD COLUMN     "dataConfirmationDeadline" TIMESTAMP(3),
ADD COLUMN     "dataConfirmationRemindedAt" TIMESTAMP(3),
ADD COLUMN     "dataConfirmationRequestedById" TEXT;

-- CreateIndex
CREATE INDEX "users_dataConfirmationDeadline_idx" ON "users"("dataConfirmationDeadline");
