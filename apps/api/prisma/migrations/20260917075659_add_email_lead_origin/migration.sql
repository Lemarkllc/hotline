-- CreateEnum
CREATE TYPE "EmailLeadOrigin" AS ENUM ('EMAIL', 'WEBSITE');

-- AlterTable
ALTER TABLE "email_leads" ADD COLUMN     "origin" "EmailLeadOrigin" NOT NULL DEFAULT 'EMAIL';
