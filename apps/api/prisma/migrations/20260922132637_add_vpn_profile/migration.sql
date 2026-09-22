-- CreateTable
CREATE TABLE "vpn_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "panelEmail" TEXT NOT NULL,
    "subId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "vpn_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vpn_profiles_userId_key" ON "vpn_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "vpn_profiles_panelEmail_key" ON "vpn_profiles"("panelEmail");

-- CreateIndex
CREATE UNIQUE INDEX "vpn_profiles_subId_key" ON "vpn_profiles"("subId");

-- AddForeignKey
ALTER TABLE "vpn_profiles" ADD CONSTRAINT "vpn_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
