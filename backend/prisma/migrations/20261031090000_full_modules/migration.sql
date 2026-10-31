-- CreateEnum
CREATE TYPE "ChargeKind" AS ENUM ('rent', 'deposit', 'late_fee', 'other');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('pending', 'processed', 'failed');

-- CreateEnum
CREATE TYPE "RefundMethod" AS ENUM ('gateway', 'manual');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "ComplaintCategory" AS ENUM ('electrical', 'plumbing', 'cleaning', 'internet', 'food', 'furniture', 'security', 'other');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "VisitorStatus" AS ENUM ('pending', 'approved', 'rejected', 'checked_in', 'checked_out', 'cancelled');

-- CreateEnum
CREATE TYPE "VisitorSource" AS ENUM ('request', 'walk_in');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('open', 'assigned', 'in_progress', 'on_hold', 'completed');

-- CreateEnum
CREATE TYPE "MaintenanceCategory" AS ENUM ('electrical', 'plumbing', 'carpentry', 'painting', 'appliance', 'civil', 'pest_control');

-- CreateEnum
CREATE TYPE "InventoryCategory" AS ENUM ('linen', 'furniture', 'kitchen', 'cleaning', 'electrical', 'stationery', 'safety');

-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "AnnouncementCategory" AS ENUM ('general', 'maintenance', 'mess', 'event', 'urgent');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('scheduled', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('cultural', 'sports', 'workshop', 'festival', 'meeting', 'health');

-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('food', 'cleanliness', 'staff', 'facilities', 'security', 'internet', 'other');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('id_proof', 'admission_letter', 'photo', 'police_verification', 'rent_agreement', 'medical');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('missing', 'uploaded', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "EmergencyStatus" AS ENUM ('open', 'acknowledged', 'resolved');

-- DropIndex
DROP INDEX "RentCharge_studentId_period_key";

-- AlterTable (hand-edited): invitations stored their raw token as the primary key.
-- Keep existing rows usable: the id becomes a fresh uuid and the token is replaced
-- by its SHA-256, which is what the API now looks invitations up by.
ALTER TABLE "Invitation"
ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "id" TEXT,
ADD COLUMN     "staffId" TEXT,
ADD COLUMN     "studentId" TEXT,
ADD COLUMN     "tokenHash" TEXT;
UPDATE "Invitation" SET "id" = gen_random_uuid()::text,
                        "tokenHash" = encode(sha256(convert_to("token", 'UTF8')), 'hex');
ALTER TABLE "Invitation" DROP CONSTRAINT "Invitation_pkey",
DROP COLUMN "token",
ALTER COLUMN "id" SET NOT NULL,
ALTER COLUMN "tokenHash" SET NOT NULL,
ADD CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "planId" TEXT NOT NULL DEFAULT 'starter',
ADD COLUMN     "settings" JSONB NOT NULL DEFAULT '{}';
-- Plan limits are new: organizations that already exist must not be blocked by them.
UPDATE "Organization" SET "planId" = 'portfolio';

-- AlterTable (hand-edited): existing refresh tokens each become their own family.
ALTER TABLE "RefreshToken" ADD COLUMN     "familyId" TEXT NOT NULL DEFAULT gen_random_uuid()::text;
ALTER TABLE "RefreshToken" ALTER COLUMN "familyId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RentCharge" ADD COLUMN     "createdBy" TEXT NOT NULL DEFAULT 'system',
ADD COLUMN     "kind" "ChargeKind" NOT NULL DEFAULT 'rent',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "disabledAt" TIMESTAMP(3),
ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "refundNo" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "method" "RefundMethod" NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'pending',
    "adjustCharge" BOOLEAN NOT NULL DEFAULT false,
    "gatewayRefundId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplaintComment" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorRole" "Role" NOT NULL,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplaintHistory" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "status" "ComplaintStatus" NOT NULL,
    "changedBy" TEXT NOT NULL,
    "note" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "destination" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'pending',
    "decisionReason" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitorRequest" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "source" "VisitorSource" NOT NULL DEFAULT 'request',
    "visitorName" TEXT NOT NULL,
    "visitorPhone" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "visitDate" DATE NOT NULL,
    "visitTime" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" "VisitorStatus" NOT NULL DEFAULT 'pending',
    "decisionReason" TEXT,
    "decidedBy" TEXT,
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitorRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "category" "FeedbackCategory" NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyAlert" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "status" "EmergencyStatus" NOT NULL DEFAULT 'open',
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmergencyAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceTicket" (
    "id" TEXT NOT NULL,
    "ticketNo" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "MaintenanceCategory" NOT NULL,
    "location" TEXT NOT NULL,
    "priority" "Priority" NOT NULL,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'open',
    "assigneeStaffId" TEXT,
    "vendor" TEXT,
    "estimatedCost" INTEGER NOT NULL DEFAULT 0,
    "actualCost" INTEGER,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "category" "InventoryCategory" NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reorderLevel" INTEGER NOT NULL,
    "unitCost" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "by" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" "AnnouncementCategory" NOT NULL,
    "audienceType" TEXT NOT NULL DEFAULT 'all',
    "audienceValues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'draft',
    "author" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementRead" (
    "announcementId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementRead_pkey" PRIMARY KEY ("announcementId","studentId")
);

-- CreateTable
CREATE TABLE "HostelEvent" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "EventCategory" NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "expectedAttendance" INTEGER NOT NULL DEFAULT 0,
    "status" "EventStatus" NOT NULL DEFAULT 'scheduled',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HostelEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'missing',
    "uploadId" TEXT,
    "note" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "complaintId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlySnapshot" (
    "propertyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "beds" INTEGER NOT NULL,
    "occupiedBeds" INTEGER NOT NULL,
    "occupancyPct" INTEGER NOT NULL,
    "expected" INTEGER NOT NULL,
    "collected" INTEGER NOT NULL,
    "arrears" INTEGER NOT NULL,
    "complaints" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlySnapshot_pkey" PRIMARY KEY ("propertyId","period")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "ok" BOOLEAN,
    "result" JSONB,
    "error" TEXT,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_refundNo_key" ON "Refund"("refundNo");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_gatewayRefundId_key" ON "Refund"("gatewayRefundId");

-- CreateIndex
CREATE INDEX "Refund_chargeId_status_idx" ON "Refund"("chargeId", "status");

-- CreateIndex
CREATE INDEX "Refund_paymentId_idx" ON "Refund"("paymentId");

-- CreateIndex
CREATE INDEX "Refund_propertyId_createdAt_idx" ON "Refund"("propertyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Complaint_ticketNo_key" ON "Complaint"("ticketNo");

-- CreateIndex
CREATE INDEX "Complaint_propertyId_status_idx" ON "Complaint"("propertyId", "status");

-- CreateIndex
CREATE INDEX "Complaint_studentId_idx" ON "Complaint"("studentId");

-- CreateIndex
CREATE INDEX "ComplaintComment_complaintId_idx" ON "ComplaintComment"("complaintId");

-- CreateIndex
CREATE INDEX "ComplaintHistory_complaintId_idx" ON "ComplaintHistory"("complaintId");

-- CreateIndex
CREATE INDEX "LeaveRequest_propertyId_status_idx" ON "LeaveRequest"("propertyId", "status");

-- CreateIndex
CREATE INDEX "LeaveRequest_studentId_status_idx" ON "LeaveRequest"("studentId", "status");

-- CreateIndex
CREATE INDEX "VisitorRequest_propertyId_visitDate_idx" ON "VisitorRequest"("propertyId", "visitDate");

-- CreateIndex
CREATE INDEX "VisitorRequest_propertyId_status_idx" ON "VisitorRequest"("propertyId", "status");

-- CreateIndex
CREATE INDEX "VisitorRequest_studentId_idx" ON "VisitorRequest"("studentId");

-- CreateIndex
CREATE INDEX "Feedback_propertyId_createdAt_idx" ON "Feedback"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_studentId_category_createdAt_idx" ON "Feedback"("studentId", "category", "createdAt");

-- CreateIndex
CREATE INDEX "EmergencyAlert_propertyId_status_idx" ON "EmergencyAlert"("propertyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceTicket_ticketNo_key" ON "MaintenanceTicket"("ticketNo");

-- CreateIndex
CREATE INDEX "MaintenanceTicket_propertyId_status_idx" ON "MaintenanceTicket"("propertyId", "status");

-- CreateIndex
CREATE INDEX "InventoryItem_propertyId_category_idx" ON "InventoryItem"("propertyId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_propertyId_sku_key" ON "InventoryItem"("propertyId", "sku");

-- CreateIndex
CREATE INDEX "InventoryTransaction_itemId_at_idx" ON "InventoryTransaction"("itemId", "at");

-- CreateIndex
CREATE INDEX "InventoryTransaction_propertyId_at_idx" ON "InventoryTransaction"("propertyId", "at");

-- CreateIndex
CREATE INDEX "Announcement_propertyId_status_idx" ON "Announcement"("propertyId", "status");

-- CreateIndex
CREATE INDEX "AnnouncementRead_studentId_idx" ON "AnnouncementRead"("studentId");

-- CreateIndex
CREATE INDEX "HostelEvent_propertyId_date_idx" ON "HostelEvent"("propertyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRecord_uploadId_key" ON "DocumentRecord"("uploadId");

-- CreateIndex
CREATE INDEX "DocumentRecord_propertyId_status_idx" ON "DocumentRecord"("propertyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRecord_studentId_type_key" ON "DocumentRecord"("studentId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Upload_key_key" ON "Upload"("key");

-- CreateIndex
CREATE INDEX "Upload_ownerUserId_idx" ON "Upload"("ownerUserId");

-- CreateIndex
CREATE INDEX "Upload_confirmedAt_createdAt_idx" ON "Upload"("confirmedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Upload_complaintId_idx" ON "Upload"("complaintId");

-- CreateIndex
CREATE INDEX "JobRun_name_startedAt_idx" ON "JobRun"("name", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_studentId_idx" ON "Invitation"("studentId");

-- CreateIndex
CREATE INDEX "Invitation_staffId_idx" ON "Invitation"("staffId");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "RentCharge_studentId_period_idx" ON "RentCharge"("studentId", "period");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "RentCharge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintComment" ADD CONSTRAINT "ComplaintComment_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintHistory" ADD CONSTRAINT "ComplaintHistory_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorRequest" ADD CONSTRAINT "VisitorRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorRequest" ADD CONSTRAINT "VisitorRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostelEvent" ADD CONSTRAINT "HostelEvent_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRecord" ADD CONSTRAINT "DocumentRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRecord" ADD CONSTRAINT "DocumentRecord_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRecord" ADD CONSTRAINT "DocumentRecord_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlySnapshot" ADD CONSTRAINT "MonthlySnapshot_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ── Hand-written: rules Prisma's schema language cannot express ──────────────
-- One rent and one late fee per student per month; at most one deposit each.
CREATE UNIQUE INDEX "RentCharge_one_per_period" ON "RentCharge"("studentId", "period", "kind") WHERE "kind" IN ('rent', 'late_fee');
CREATE UNIQUE INDEX "RentCharge_one_deposit" ON "RentCharge"("studentId") WHERE "kind" = 'deposit';
ALTER TABLE "RentCharge" ADD CONSTRAINT "RentCharge_amount_nonnegative" CHECK ("amount" >= 0);

ALTER TABLE "Refund" ADD CONSTRAINT "Refund_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_dates_ordered" CHECK ("toDate" >= "fromDate");
ALTER TABLE "HostelEvent" ADD CONSTRAINT "HostelEvent_capacity_nonnegative" CHECK ("capacity" >= 0 AND "expectedAttendance" >= 0);
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_costs_nonnegative" CHECK ("estimatedCost" >= 0 AND ("actualCost" IS NULL OR "actualCost" >= 0));

-- Stock can never go negative, whatever the code does.
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_amounts_nonnegative" CHECK ("quantity" >= 0 AND "reorderLevel" >= 0 AND "unitCost" >= 0);
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_type" CHECK ("type" IN ('in', 'out'));
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_quantity_positive" CHECK ("quantity" > 0);

ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_audience_type" CHECK ("audienceType" IN ('all', 'floors', 'rooms'));
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_purpose" CHECK ("purpose" IN ('document', 'complaint'));
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_size_positive" CHECK ("sizeBytes" > 0);

-- Global search uses case-insensitive substring matching; trigram indexes keep it fast.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "StudentProfile_name_trgm" ON "StudentProfile" USING gin ("name" gin_trgm_ops);
CREATE INDEX "StaffMember_name_trgm" ON "StaffMember" USING gin ("name" gin_trgm_ops);
CREATE INDEX "Complaint_title_trgm" ON "Complaint" USING gin ("title" gin_trgm_ops);
CREATE INDEX "Announcement_title_trgm" ON "Announcement" USING gin ("title" gin_trgm_ops);