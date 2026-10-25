-- Bed / resident integrity rules, enforced by the database itself.
--
-- Prisma's schema language cannot express CHECK constraints, so they live only
-- here. If existing rows already break a rule this migration aborts with a
-- message and changes nothing (the whole migration runs in one transaction);
-- the data must then be reviewed and fixed by hand. It never "repairs" rows.

DO $$
DECLARE
  bad_beds     integer;
  bad_checkout integer;
  bad_links    integer;
BEGIN
  SELECT count(*) INTO bad_beds FROM "Bed"
   WHERE ("status" = 'occupied') <> ("studentId" IS NOT NULL);
  SELECT count(*) INTO bad_checkout FROM "StudentProfile"
   WHERE "status" = 'moved_out' AND "bedId" IS NOT NULL;
  SELECT count(*) INTO bad_links FROM "StudentProfile" s
   LEFT JOIN "Bed" b ON b."id" = s."bedId"
   WHERE s."bedId" IS NOT NULL AND (b."id" IS NULL OR b."studentId" IS DISTINCT FROM s."id");

  IF bad_beds + bad_checkout + bad_links > 0 THEN
    RAISE EXCEPTION 'bed_integrity: % bed(s) with status/resident mismatch, % moved-out resident(s) still holding a bed, % resident(s) pointing at a bed not linked back. Nothing was changed; fix these rows, then re-run.',
      bad_beds, bad_checkout, bad_links;
  END IF;
END $$;

-- A bed is occupied exactly when it has a resident.
ALTER TABLE "Bed"
  ADD CONSTRAINT "Bed_occupied_iff_student"
  CHECK (("status" = 'occupied') = ("studentId" IS NOT NULL));

-- A resident who has moved out holds no bed.
ALTER TABLE "StudentProfile"
  ADD CONSTRAINT "StudentProfile_moved_out_has_no_bed"
  CHECK (NOT ("status" = 'moved_out' AND "bedId" IS NOT NULL));
