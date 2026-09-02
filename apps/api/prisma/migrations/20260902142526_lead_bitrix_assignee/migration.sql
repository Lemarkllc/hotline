/*
  Warnings:

  - You are about to drop the column `assigneeId` on the `email_leads` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "email_leads" DROP CONSTRAINT "email_leads_assigneeId_fkey";

-- AlterTable
ALTER TABLE "email_leads" DROP COLUMN "assigneeId",
ADD COLUMN     "bitrixAssigneeEmail" TEXT,
ADD COLUMN     "bitrixAssigneeId" TEXT,
ADD COLUMN     "bitrixAssigneeName" TEXT;
