-- DropForeignKey
ALTER TABLE "ratings" DROP CONSTRAINT "ratings_authorId_fkey";

-- AlterTable
ALTER TABLE "ratings" ADD COLUMN     "externalContactId" TEXT,
ADD COLUMN     "wouldRecommendScore" INTEGER,
ADD COLUMN     "wouldReturnScore" INTEGER,
ALTER COLUMN "authorId" DROP NOT NULL,
ALTER COLUMN "score" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_externalContactId_fkey" FOREIGN KEY ("externalContactId") REFERENCES "external_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
