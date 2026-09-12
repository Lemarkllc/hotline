-- CreateEnum
CREATE TYPE "LeadIrrelevantCategory" AS ENUM ('SPAM', 'COURSE_OR_TRAINING', 'VACANCY', 'SUPPLIER_PITCH', 'PHISHING_ATTEMPT', 'OTHER');

-- AlterTable
ALTER TABLE "email_leads" ADD COLUMN     "irrelevantCategory" "LeadIrrelevantCategory";
