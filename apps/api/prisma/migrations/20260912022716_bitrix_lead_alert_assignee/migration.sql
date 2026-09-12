/*
  Warnings:

  - Added the required column `assignedById` to the `bitrix_lead_alerts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "bitrix_lead_alerts" ADD COLUMN     "assignedById" TEXT NOT NULL;
