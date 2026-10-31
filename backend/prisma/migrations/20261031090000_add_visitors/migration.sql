-- CreateEnum
CREATE TYPE "VisitorStatus" AS ENUM ('pending', 'approved', 'rejected', 'checked_in', 'checked_out', 'cancelled');

-- CreateEnum
CREATE TYPE "VisitorSource" AS ENUM ('request', 'walk_in');

-- CreateTable
CREATE TABLE "VisitorRequest" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "source" "VisitorSource" NOT NULL DEFAULT 'request',
    "visitorName" TEXT NOT NULL,
    "visitorPhone" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "visitTime" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" "VisitorStatus" NOT NULL DEFAULT 'pending',
    "decisionReason" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitorRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisitorRequest_propertyId_visitDate_idx" ON "VisitorRequest"("propertyId", "visitDate");

-- CreateIndex
CREATE INDEX "VisitorRequest_studentId_status_idx" ON "VisitorRequest"("studentId", "status");

-- AddForeignKey
ALTER TABLE "VisitorRequest" ADD CONSTRAINT "VisitorRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorRequest" ADD CONSTRAINT "VisitorRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

