-- CreateEnum
CREATE TYPE "BusinessTripTransport" AS ENUM ('CAR', 'PLANE', 'TRAIN', 'OTHER');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "hireDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "vacation_requests" ADD COLUMN     "paid" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "vacation_balances" (
    "userId" TEXT NOT NULL,
    "startingBalance" DOUBLE PRECISION NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vacation_balances_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "absence_requests" (
    "id" TEXT NOT NULL,
    "publicNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "fullDay" BOOLEAN NOT NULL,
    "timeFrom" TEXT,
    "timeTo" TEXT,
    "reason" TEXT,
    "status" "VacationStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "absence_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_trip_requests" (
    "id" TEXT NOT NULL,
    "publicNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3) NOT NULL,
    "purpose" TEXT NOT NULL,
    "transport" "BusinessTripTransport" NOT NULL,
    "transportOther" TEXT,
    "hotelNeeded" BOOLEAN NOT NULL,
    "status" "VacationStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_trip_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "absence_requests_publicNumber_key" ON "absence_requests"("publicNumber");

-- CreateIndex
CREATE INDEX "absence_requests_userId_status_idx" ON "absence_requests"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "business_trip_requests_publicNumber_key" ON "business_trip_requests"("publicNumber");

-- CreateIndex
CREATE INDEX "business_trip_requests_userId_status_idx" ON "business_trip_requests"("userId", "status");

-- AddForeignKey
ALTER TABLE "vacation_balances" ADD CONSTRAINT "vacation_balances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absence_requests" ADD CONSTRAINT "absence_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absence_requests" ADD CONSTRAINT "absence_requests_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_trip_requests" ADD CONSTRAINT "business_trip_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_trip_requests" ADD CONSTRAINT "business_trip_requests_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
