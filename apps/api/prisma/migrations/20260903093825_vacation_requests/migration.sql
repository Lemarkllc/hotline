-- CreateEnum
CREATE TYPE "VacationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "vacation_requests" (
    "id" TEXT NOT NULL,
    "publicNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3) NOT NULL,
    "comment" TEXT,
    "status" "VacationStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vacation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vacation_requests_publicNumber_key" ON "vacation_requests"("publicNumber");

-- CreateIndex
CREATE INDEX "vacation_requests_userId_status_idx" ON "vacation_requests"("userId", "status");

-- AddForeignKey
ALTER TABLE "vacation_requests" ADD CONSTRAINT "vacation_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacation_requests" ADD CONSTRAINT "vacation_requests_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
