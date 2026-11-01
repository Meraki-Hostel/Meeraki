import "./helpers/env.js";
import { readFileSync } from "node:fs";
import { describe, test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, resetDb, seedWorld, disconnect } from "./helpers/db.js";

let w;
beforeEach(async () => { await resetDb(); w = await seedWorld(); });
after(disconnect);

const migration = (name) => readFileSync(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url), "utf8");
const doBlock = (sql) => sql.slice(sql.indexOf("DO $$"), sql.indexOf("END $$;") + "END $$;".length);

/** Runs fn inside a transaction that is ALWAYS rolled back; returns fn's result or the error message. */
async function inRolledBackTx(fn) {
  const ROLLBACK = new Error("rollback");
  let result;
  await prisma.$transaction(async (tx) => {
    try { result = await fn(tx); } catch (e) { result = { error: String(e.message) }; }
    throw ROLLBACK;
  }).catch((e) => { if (e !== ROLLBACK) throw e; });
  return result;
}

describe("migration 20261023130000_payment_status: classifies existing payments only from evidence", () => {
  const classify = doBlock(migration("20261023130000_payment_status"));

  // Recreate the pre-migration shape (no status), plant rows written by each old code path, run the classifier.
  const plant = async (tx, rows) => {
    await tx.$executeRawUnsafe('ALTER TABLE "Payment" DROP COLUMN "status" CASCADE');
    await tx.$executeRawUnsafe('ALTER TABLE "Payment" ADD COLUMN "status" "PaymentStatus"');
    for (const r of rows) {
      await tx.$executeRaw`
        INSERT INTO "Payment" ("id","chargeId","studentId","propertyId","amount","method","paidOn","reference","receiptNo","recordedBy","note","gatewayOrderId","gatewayPaymentId")
        VALUES (${r.id}, ${w.chargeA.id}, ${w.residentA.id}, ${w.A.id}, 100, 'upi', now(), ${r.reference}, ${r.receiptNo}, 'x', ${r.note ?? null}, ${r.gatewayOrderId ?? null}, ${r.gatewayPaymentId ?? null})`;
    }
    await tx.$executeRawUnsafe(classify);
    return tx.$queryRaw`SELECT "id", "status"::text AS status FROM "Payment" ORDER BY "id"`;
  };

  test("each kind of row written by the old code gets the status its evidence supports", async () => {
    const out = await inRolledBackTx((tx) => plant(tx, [
      { id: "1-staff-cash", reference: "", receiptNo: "RCPT-2026-0001" },
      { id: "2-staff-upi", reference: "UTR123", receiptNo: "RCPT-2026-0002", note: "paid at desk" },
      { id: "3-simulated", reference: "SIM123456789", receiptNo: "RCPT-2026-0003", note: "Simulated online payment (demo)" },
      { id: "4-pending", reference: "PENDING_order_1", receiptNo: "PENDING-order_1", gatewayOrderId: "order_1" },
      { id: "5-webhook", reference: "pay_9", receiptNo: "RCPT-2026-0004", gatewayOrderId: "order_2", gatewayPaymentId: "pay_9" },
    ]));
    assert.deepEqual(out, [
      { id: "1-staff-cash", status: "captured" },
      { id: "2-staff-upi", status: "captured" },
      { id: "3-simulated", status: "simulated" },
      { id: "4-pending", status: "pending" },
      { id: "5-webhook", status: "captured" },
    ]);
  });

  test("a row with no clear evidence aborts the migration instead of being guessed", async () => {
    const out = await inRolledBackTx((tx) => plant(tx, [
      { id: "ok", reference: "", receiptNo: "RCPT-2026-0001" },
      // gateway order but a real receipt and no gateway payment id: received or not? Unknown.
      { id: "ambiguous", reference: "x", receiptNo: "RCPT-2026-0009", gatewayOrderId: "order_9" },
    ]));
    assert.match(out.error ?? "", /payment_status: 1 payment row\(s\) have no clear evidence/);
  });

  test("the database refuses a second open order for the same charge and a non-positive amount", async () => {
    const base = { chargeId: w.chargeA.id, studentId: w.residentA.id, propertyId: w.A.id, method: "upi", paidOn: new Date(), recordedBy: "x" };
    await prisma.payment.create({ data: { ...base, amount: 100, status: "pending", reference: "a", receiptNo: "PENDING-a", gatewayOrderId: "a" } });
    await assert.rejects(prisma.payment.create({ data: { ...base, amount: 100, status: "pending", reference: "b", receiptNo: "PENDING-b", gatewayOrderId: "b" } }), /Unique constraint/i);
    await assert.rejects(prisma.payment.create({ data: { ...base, amount: 0, status: "captured", reference: "c", receiptNo: "RCPT-X" } }), /check constraint/i);
  });
});

describe("migration 20261023120000_bed_integrity", () => {
  test("its pre-check aborts on inconsistent existing data instead of repairing it", async () => {
    const out = await inRolledBackTx(async (tx) => {
      await tx.$executeRawUnsafe('ALTER TABLE "Bed" DROP CONSTRAINT "Bed_occupied_iff_student"');
      await tx.$executeRawUnsafe(`UPDATE "Bed" SET "status" = 'occupied' WHERE "id" = '${w.roomA.beds[1].id}'`);
      await tx.$executeRawUnsafe(doBlock(migration("20261023120000_bed_integrity")));
      return "passed";
    });
    assert.match(out.error ?? "", /bed_integrity: 1 bed\(s\) with status\/resident mismatch/);
    const bed = await prisma.bed.findUnique({ where: { id: w.roomA.beds[1].id } });
    assert.equal(bed.status, "available", "the rolled-back test changed data");
  });
});

describe("migration 20261025090000_organizations: backfill", () => {
  const backfill = doBlock(migration("20261025090000_organizations"));
  const TABLES = ["Property", "User", "StaffMember", "Invitation", "ActivityLog"];

  // Back to the pre-migration shape: no organizations, nullable orgId, no org keys.
  const preMigration = async (tx) => {
    for (const t of TABLES) await tx.$executeRawUnsafe(`ALTER TABLE "${t}" DROP COLUMN "orgId" CASCADE`);
    await tx.$executeRawUnsafe('DELETE FROM "Organization"');
    for (const t of TABLES) await tx.$executeRawUnsafe(`ALTER TABLE "${t}" ADD COLUMN "orgId" TEXT`);
  };

  test("every existing row joins one new organization", async () => {
    await prisma.staffMember.create({ data: { orgId: w.org.id, name: "S", role: "warden", propertyId: w.A.id, phone: "1", email: "s@example.test", joinedOn: new Date() } });
    await prisma.activityLog.create({ data: { orgId: w.org.id, propertyId: w.A.id, actorName: "a", actorRole: "owner", category: "c", message: "m" } });
    await prisma.invitation.create({ data: { orgId: w.org.id, tokenHash: "inv-m", name: "n", email: "n@example.test", role: "manager", propertyId: w.A.id, invitedBy: "x", expiresAt: new Date() } });
    const out = await inRolledBackTx(async (tx) => {
      await preMigration(tx);
      await tx.$executeRawUnsafe(backfill);
      const orgs = await tx.$queryRawUnsafe('SELECT "id", "name" FROM "Organization"');
      const perTable = {};
      for (const t of TABLES) {
        perTable[t] = await tx.$queryRawUnsafe(`SELECT count(*)::int AS rows, count(DISTINCT "orgId")::int AS orgs, count(*) FILTER (WHERE "orgId" IS NULL)::int AS missing FROM "${t}"`);
      }
      return { orgs, perTable };
    });
    assert.equal(out.orgs.length, 1);
    assert.equal(out.orgs[0].name, "Default organization");
    for (const t of TABLES) {
      const [r] = out.perTable[t];
      assert.equal(r.missing, 0, `${t} rows left without an organization`);
      assert.ok(r.rows > 0, `${t} fixture missing`);
      assert.equal(r.orgs, 1, `${t} rows split across organizations`);
    }
  });

  test("an empty database gets no organization", async () => {
    const out = await inRolledBackTx(async (tx) => {
      await preMigration(tx);
      for (const t of ["Payment", "RentCharge", "Bed", "StudentProfile", "RefreshToken", "Notification", ...TABLES, "Room"]) await tx.$executeRawUnsafe(`DELETE FROM "${t}"`);
      await tx.$executeRawUnsafe(backfill);
      return tx.$queryRawUnsafe('SELECT count(*)::int AS n FROM "Organization"');
    });
    assert.equal(out[0].n, 0);
  });

  test("a user pointing at a property that does not exist aborts the migration", async () => {
    const out = await inRolledBackTx(async (tx) => {
      await preMigration(tx);
      await tx.$executeRawUnsafe(`UPDATE "User" SET "propertyId" = 'no-such-property' WHERE "id" = '${w.users.managerA.id}'`);
      await tx.$executeRawUnsafe(backfill);
      return "passed";
    });
    assert.match(out.error ?? "", /organizations: rows point at properties that do not exist \(users 1,/);
  });
});
