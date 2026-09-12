-- AlterTable
ALTER TABLE "email_leads" ADD COLUMN     "slaBreachSentAt" TIMESTAMP(3),
ADD COLUMN     "slaWarningSentAt" TIMESTAMP(3);
