-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "ComplaintCategory" AS ENUM ('electrical', 'plumbing', 'cleaning', 'internet', 'food', 'furniture', 'security', 'other');

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "ticketNo" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "roomId" TEXT,
    "category" "ComplaintCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "Priority" NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'open',
    "assigneeStaffId" TEXT,
    "attachments" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplaintComment" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorRole" "Role" NOT NULL,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplaintStatusChange" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "status" "ComplaintStatus" NOT NULL,
    "changedBy" TEXT NOT NULL,
    "note" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Complaint_ticketNo_key" ON "Complaint"("ticketNo");

-- CreateIndex
CREATE INDEX "Complaint_propertyId_status_idx" ON "Complaint"("propertyId", "status");

-- CreateIndex
CREATE INDEX "Complaint_studentId_idx" ON "Complaint"("studentId");

-- CreateIndex
CREATE INDEX "ComplaintComment_complaintId_createdAt_idx" ON "ComplaintComment"("complaintId", "createdAt");

-- CreateIndex
CREATE INDEX "ComplaintStatusChange_complaintId_at_idx" ON "ComplaintStatusChange"("complaintId", "at");

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_assigneeStaffId_fkey" FOREIGN KEY ("assigneeStaffId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintComment" ADD CONSTRAINT "ComplaintComment_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintStatusChange" ADD CONSTRAINT "ComplaintStatusChange_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

