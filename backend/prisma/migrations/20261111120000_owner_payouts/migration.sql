-- CreateEnum
CREATE TYPE "PayoutKycStatus" AS ENUM ('draft', 'submitted', 'under_review', 'needs_clarification', 'active', 'rejected', 'suspended');

-- CreateEnum
CREATE TYPE "PayoutBusinessType" AS ENUM ('individual', 'proprietorship', 'partnership', 'llp', 'private_limited', 'public_limited', 'trust', 'society', 'ngo');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('created', 'processed', 'failed', 'reversed');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "payoutAccountId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "gatewayTransferId" TEXT,
ADD COLUMN     "payoutAccountId" TEXT,
ADD COLUMN     "transferStatus" "TransferStatus";

-- CreateTable
CREATE TABLE "PayoutAccount" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "businessType" "PayoutBusinessType" NOT NULL,
    "legalName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "bankHolderName" TEXT NOT NULL,
    "bankLast4" TEXT NOT NULL,
    "ifsc" TEXT NOT NULL,
    "kycStatus" "PayoutKycStatus" NOT NULL DEFAULT 'draft',
    "kycNote" TEXT,
    "gatewayAccountId" TEXT,
    "gatewayStakeholderId" TEXT,
    "gatewayProductId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayoutAccount_gatewayAccountId_key" ON "PayoutAccount"("gatewayAccountId");

-- CreateIndex
CREATE INDEX "PayoutAccount_orgId_idx" ON "PayoutAccount"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutAccount_id_orgId_key" ON "PayoutAccount"("id", "orgId");

-- CreateIndex
CREATE INDEX "Property_payoutAccountId_idx" ON "Property"("payoutAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_gatewayTransferId_key" ON "Payment"("gatewayTransferId");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_payoutAccountId_orgId_fkey" FOREIGN KEY ("payoutAccountId", "orgId") REFERENCES "PayoutAccount"("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_payoutAccountId_fkey" FOREIGN KEY ("payoutAccountId") REFERENCES "PayoutAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutAccount" ADD CONSTRAINT "PayoutAccount_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

