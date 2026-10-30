-- Organizations: tenant isolation between owners.
--
-- Produces exactly the objects `prisma migrate diff` generates for schema.prisma
-- (same names, so there is no drift), but in three safe steps instead of adding
-- NOT NULL columns to tables that already have rows:
--   1. expand   create "Organization", add nullable "orgId" columns
--   2. backfill every existing row joins ONE organization, because today there
--               is exactly one operator (verified read-only on meraki_dev: 1 owner,
--               1 property). Rows that could not be placed consistently abort the
--               migration with counts; nothing is changed (one transaction).
--   3. contract NOT NULL, indexes, foreign keys, and the composite (propertyId, orgId)
--               keys that make the database reject a cross-organization link.
-- Splitting existing data across several organizations is NOT done here; that would
-- need an explicit mapping from the business.

-- 1. expand
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Property"    ADD COLUMN "orgId" TEXT;
ALTER TABLE "User"        ADD COLUMN "orgId" TEXT;
ALTER TABLE "StaffMember" ADD COLUMN "orgId" TEXT;
ALTER TABLE "Invitation"  ADD COLUMN "orgId" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN "orgId" TEXT;

-- 2. backfill
DO $$
DECLARE
  existing          integer;
  org               text;
  dangling_users    integer;
  dangling_staff    integer;
  dangling_invites  integer;
  dangling_activity integer;
BEGIN
  -- Links the composite keys will enforce must point at a property that exists.
  SELECT count(*) INTO dangling_users    FROM "User" u        WHERE u."propertyId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Property" p WHERE p."id" = u."propertyId");
  SELECT count(*) INTO dangling_staff    FROM "StaffMember" s WHERE s."propertyId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Property" p WHERE p."id" = s."propertyId");
  SELECT count(*) INTO dangling_invites  FROM "Invitation" i  WHERE i."propertyId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Property" p WHERE p."id" = i."propertyId");
  SELECT count(*) INTO dangling_activity FROM "ActivityLog" a WHERE a."propertyId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Property" p WHERE p."id" = a."propertyId");
  IF dangling_users + dangling_staff + dangling_invites + dangling_activity > 0 THEN
    RAISE EXCEPTION 'organizations: rows point at properties that do not exist (users %, staff %, invitations %, activity %). Nothing was changed; fix them, then re-run.',
      dangling_users, dangling_staff, dangling_invites, dangling_activity;
  END IF;

  SELECT (SELECT count(*) FROM "Property") + (SELECT count(*) FROM "User") + (SELECT count(*) FROM "StaffMember")
       + (SELECT count(*) FROM "Invitation") + (SELECT count(*) FROM "ActivityLog")
    INTO existing;
  IF existing > 0 THEN
    org := gen_random_uuid()::text;
    INSERT INTO "Organization" ("id", "name", "updatedAt") VALUES (org, 'Default organization', CURRENT_TIMESTAMP);
    UPDATE "Property"    SET "orgId" = org;
    UPDATE "User"        SET "orgId" = org;
    UPDATE "StaffMember" SET "orgId" = org;
    UPDATE "Invitation"  SET "orgId" = org;
    UPDATE "ActivityLog" SET "orgId" = org;
  END IF;
END $$;

-- 3. contract
ALTER TABLE "Property"    ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "User"        ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "StaffMember" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Invitation"  ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "ActivityLog" ALTER COLUMN "orgId" SET NOT NULL;

CREATE INDEX "ActivityLog_orgId_idx" ON "ActivityLog"("orgId");
CREATE INDEX "Invitation_orgId_idx" ON "Invitation"("orgId");
CREATE INDEX "Property_orgId_idx" ON "Property"("orgId");
CREATE UNIQUE INDEX "Property_id_orgId_key" ON "Property"("id", "orgId");
CREATE INDEX "StaffMember_orgId_idx" ON "StaffMember"("orgId");
CREATE INDEX "User_orgId_idx" ON "User"("orgId");

ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_propertyId_orgId_fkey" FOREIGN KEY ("propertyId", "orgId") REFERENCES "Property"("id", "orgId") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_propertyId_orgId_fkey" FOREIGN KEY ("propertyId", "orgId") REFERENCES "Property"("id", "orgId") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "Property" ADD CONSTRAINT "Property_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_propertyId_orgId_fkey" FOREIGN KEY ("propertyId", "orgId") REFERENCES "Property"("id", "orgId") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_propertyId_orgId_fkey" FOREIGN KEY ("propertyId", "orgId") REFERENCES "Property"("id", "orgId") ON DELETE NO ACTION ON UPDATE NO ACTION;
