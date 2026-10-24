import "./helpers/env.js";
import { describe, test, beforeEach, afterEach, after, mock } from "node:test";
import assert from "node:assert/strict";
import { prisma, resetDb, seedWorld, disconnect } from "./helpers/db.js";
import { as } from "./helpers/api.js";
import { iso, todayISO, currentPeriod } from "../src/utils/money.js";

after(disconnect);

// Application dates are Asia/Kolkata (UTC+05:30). The server runs in UTC.
const at = (isoInstant) => mock.timers.enable({ apis: ["Date"], now: new Date(isoInstant) });
afterEach(() => mock.timers.reset());

describe("date helpers: the business day is the Indian day", () => {
  test("date-only values round-trip unchanged", () => {
    assert.equal(iso(new Date("2026-01-05T00:00:00.000Z")), "2026-01-05");
    assert.equal(iso("2026-01-05"), "2026-01-05");
  });

  test("mid-day UTC is the same calendar day in IST", () => {
    at("2026-10-31T06:00:00Z"); // 11:30 IST
    assert.equal(todayISO(), "2026-10-31");
    assert.equal(currentPeriod(), "2026-10");
  });

  test("[DEF-TZ] after 18:30 UTC it is already tomorrow in India: todayISO", () => {
    at("2026-10-31T19:00:00Z"); // 00:30 IST on 1 Nov
    assert.equal(todayISO(), "2026-11-01");
  });

  test("[DEF-TZ] after 18:30 UTC on the last day of a month, the billing period has rolled over", () => {
    at("2026-10-31T19:00:00Z");
    assert.equal(currentPeriod(), "2026-11");
  });

  test("[DEF-TZ] the year rolls over at IST midnight too", () => {
    at("2026-12-31T19:00:00Z");
    assert.equal(currentPeriod(), "2027-01");
  });
});

describe("date handling through the API", () => {
  let w;
  beforeEach(async () => { await resetDb(); w = await seedWorld(); });

  test("[DEF-TZ] a payment dated with today's Indian date is accepted just after IST midnight", async () => {
    at("2026-10-31T19:00:00Z"); // it is 1 Nov 00:30 in India; the UTC date is still 31 Oct
    const mgr = await as(w.users.managerA); // minted inside the window so the token is not "expired"
    const res = await mgr.post("/payments/record", {
      chargeId: w.chargeA.id, amount: 100, method: "cash", paidOn: "2026-11-01", reference: "",
    });
    assert.equal(res.status, 201, `rejected: ${JSON.stringify(res.body.error)}`);
  });

  test("a receipt issued just after IST midnight on 1 Jan carries the new year", async () => {
    at("2026-12-31T19:00:00Z"); // 1 Jan 2027, 00:30 IST
    const mgr = await as(w.users.managerA);
    const res = await mgr.post("/payments/record", {
      chargeId: w.chargeA.id, amount: 100, method: "cash", paidOn: "2027-01-01", reference: "",
    });
    assert.equal(res.status, 201, JSON.stringify(res.body.error));
    assert.match(res.body.data.receiptNo, /^RCPT-2027-/);
  });

  test("the default billing period for summaries follows the Indian month", async () => {
    // Charges for the Indian "current" month (Nov) exist only once it is Nov in India.
    await prisma.rentCharge.create({
      data: { studentId: w.residentA.id, propertyId: w.A.id, period: "2026-11", amount: 5000, dueDate: new Date("2026-11-05T00:00:00Z"), description: "Rent 2026-11" },
    });
    at("2026-10-31T19:00:00Z");
    const sum = await (await as(w.users.managerA)).get("/payments/summary");
    assert.equal(sum.body.data.expected, 5000, "summary used the UTC month (October), not the Indian month (November)");
  });
});
