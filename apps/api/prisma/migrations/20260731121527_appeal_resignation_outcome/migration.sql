-- CreateEnum
CREATE TYPE "ResignationOutcome" AS ENUM ('TERMINATED', 'WITHDRAWN');

-- AlterTable
ALTER TABLE "appeals" ADD COLUMN     "resignationOutcome" "ResignationOutcome";
