-- AlterTable
ALTER TABLE "email_leads" ADD COLUMN     "aiError" TEXT,
ADD COLUMN     "aiIsRelevant" BOOLEAN,
ADD COLUMN     "aiProcessedAt" TIMESTAMP(3),
ADD COLUMN     "aiReasoning" TEXT;
