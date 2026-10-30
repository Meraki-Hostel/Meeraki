-- Payment status: only money that was actually received counts toward balances.
--
-- Existing rows are classified ONLY from evidence the API itself wrote:
--   pending   receiptNo 'PENDING-…' and no gateway payment id (Razorpay order, unconfirmed)
--   simulated reference 'SIM…' or note 'Simulated online payment%' (no money moved)
--   captured  gateway payment id present with a real receipt (signed webhook confirmed it)
--   captured  no gateway order at all (recorded by staff as money received)
-- Any row matching none of these aborts the migration with a count; nothing is changed
-- (the migration runs in one transaction). Such rows need a human decision.

CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'captured', 'failed', 'simulated');

ALTER TABLE "Payment" ADD COLUMN "status" "PaymentStatus";

DO $$
DECLARE
  unclassified integer;
BEGIN
  UPDATE "Payment" SET "status" = 'pending'
   WHERE "receiptNo" LIKE 'PENDING-%' AND "gatewayPaymentId" IS NULL;

  UPDATE "Payment" SET "status" = 'simulated'
   WHERE "status" IS NULL
     AND ("reference" LIKE 'SIM%' OR "note" LIKE 'Simulated online payment%');

  UPDATE "Payment" SET "status" = 'captured'
   WHERE "status" IS NULL
     AND "gatewayPaymentId" IS NOT NULL AND "receiptNo" NOT LIKE 'PENDING-%';

  UPDATE "Payment" SET "status" = 'captured'
   WHERE "status" IS NULL
     AND "gatewayOrderId" IS NULL AND "gatewayPaymentId" IS NULL;

  SELECT count(*) INTO unclassified FROM "Payment" WHERE "status" IS NULL;
  IF unclassified > 0 THEN
    RAISE EXCEPTION 'payment_status: % payment row(s) have no clear evidence of being pending, simulated or received. Nothing was changed; review them before re-running.', unclassified;
  END IF;
END $$;

ALTER TABLE "Payment" ALTER COLUMN "status" SET NOT NULL;

CREATE INDEX "Payment_chargeId_status_idx" ON "Payment"("chargeId", "status");

-- At most one open gateway order per charge.
CREATE UNIQUE INDEX "Payment_one_pending_per_charge" ON "Payment"("chargeId") WHERE "status" = 'pending';

-- A payment is always a positive amount.
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_positive" CHECK ("amount" > 0);
