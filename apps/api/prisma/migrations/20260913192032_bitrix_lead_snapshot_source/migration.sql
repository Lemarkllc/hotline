/*
  Warnings:

  - Added the required column `sourceId` to the `bitrix_lead_snapshots` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- Дефолт '' только для существующих строк (у них ещё нет SOURCE_ID) — очередной
-- managerLeadRatingService.refreshSnapshots (при старте/раз в сутки) перезапишет
-- реальным значением через upsertAll. Новые строки Prisma всегда создаёт с явным
-- sourceId, дефолт их не касается.
ALTER TABLE "bitrix_lead_snapshots" ADD COLUMN     "sourceId" TEXT NOT NULL DEFAULT '';
