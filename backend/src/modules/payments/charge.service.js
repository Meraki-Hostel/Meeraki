import { prisma } from "../../config/prisma.js";
import { invalid, notFound, conflict } from "../../utils/ApiError.js";
import { requireRole, assertPropertyAccess } from "../../utils/scope.js";
import { iso, todayISO, currentPeriod, withBalance } from "../../utils/money.js";
import { ledgerRows } from "../../utils/ledger.js";
import { logActivity, notifyStudentUsers } from "../../utils/sideEffects.js";
import { settingsFor } from "../settings/settings.service.js";

const inr = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const monthName = (period) => new Date(`${period}-01T00:00:00Z`).toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const daysIn = (period) => new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0)).getUTCDate();
const dateOn = (period, day) => new Date(`${period}-${String(day).padStart(2, "0")}T00:00:00.000Z`);

/**
 * Rent for one student for one month. A student who joined during the month pays
 * only for the days from their joining day (when pro-rating is on), and their due
 * date is never before they joined. Returns null when nothing is owed.
 */
export function rentFor(student, period, settings) {
  const joined = iso(student.joinedOn);
  const last = `${period}-${String(daysIn(period)).padStart(2, "0")}`;
  if (joined > last) return null; // joins after this month
  let amount = student.monthlyRent;
  let note = "";
  if (joined.slice(0, 7) === period && joined.slice(8) !== "01" && settings.prorateFirstMonth) {
    const days = daysIn(period) - Number(joined.slice(8)) + 1;
    amount = Math.round((student.monthlyRent * days) / daysIn(period));
    note = ` (pro-rated: ${days} of ${daysIn(period)} days)`;
  }
  if (amount <= 0) return null;
  const due = iso(dateOn(period, settings.rentDueDay));
  return { amount, dueDate: new Date(`${due > joined ? due : joined}T00:00:00.000Z`), description: `Rent for ${monthName(period)}${note}` };
}

/**
 * Raises the month's rent for every billable resident (active or on notice) in
 * scope. Idempotent: the partial unique index allows one rent charge per student
 * per month, so running it again (the daily job does) only fills gaps, e.g. for a
 * resident admitted mid-month. Returns how many charges were created.
 */
export async function generateRent({ period = currentPeriod(), orgId, propertyId } = {}) {
  if (!PERIOD.test(period)) throw invalid({ period: "Use the format YYYY-MM" });
  const orgs = await prisma.organization.findMany({ where: orgId ? { id: orgId } : {}, select: { id: true } });
  let created = 0;
  for (const org of orgs) {
    const settings = await settingsFor(org.id);
    const students = await prisma.studentProfile.findMany({
      where: { status: { in: ["active", "notice"] }, property: { orgId: org.id }, ...(propertyId ? { propertyId } : {}) },
    });
    const rows = students
      .map((s) => ({ s, rent: rentFor(s, period, settings) }))
      .filter((x) => x.rent)
      .map(({ s, rent }) => ({ studentId: s.id, propertyId: s.propertyId, kind: "rent", period, ...rent }));
    if (!rows.length) continue;
    // Insert one by one to know exactly which charges are new (and notify only those).
    for (const row of rows) {
      const inserted = await prisma.$executeRaw`
        INSERT INTO "RentCharge" ("id", "studentId", "propertyId", "kind", "period", "amount", "dueDate", "description", "createdBy", "updatedAt")
        VALUES (gen_random_uuid()::text, ${row.studentId}, ${row.propertyId}, 'rent', ${row.period}, ${row.amount}, ${row.dueDate}, ${row.description}, 'system', now())
        ON CONFLICT DO NOTHING`;
      if (inserted) {
        created++;
        await notifyStudentUsers(prisma, row.studentId, "Rent due", `${inr(row.amount)} is due by ${iso(row.dueDate)} for ${monthName(period)}.`, "payment", "/student/rent");
      }
    }
  }
  return created;
}

/**
 * Adds the owner's flat late fee to rent still unpaid after the grace period.
 * Off while the fee is ₹0. One late fee per student per month (unique index).
 */
export async function applyLateFees({ orgId, today = todayISO() } = {}) {
  const orgs = await prisma.organization.findMany({ where: orgId ? { id: orgId } : {}, select: { id: true } });
  let created = 0;
  for (const org of orgs) {
    const settings = await settingsFor(org.id);
    if (!(settings.lateFeeFlat > 0)) continue;
    const cutoff = new Date(`${today}T00:00:00.000Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - settings.lateFeeGraceDays);
    const rent = await prisma.rentCharge.findMany({ where: { kind: "rent", dueDate: { lt: cutoff }, property: { orgId: org.id } } });
    if (!rent.length) continue;
    const [rows, existing] = await Promise.all([
      ledgerRows(prisma, { chargeId: { in: rent.map((c) => c.id) } }),
      prisma.rentCharge.findMany({ where: { kind: "late_fee", studentId: { in: rent.map((c) => c.studentId) } }, select: { studentId: true, period: true } }),
    ]);
    const charged = new Set(existing.map((x) => `${x.studentId}:${x.period}`));
    for (const c of rent) {
      if (charged.has(`${c.studentId}:${c.period}`) || withBalance(c, rows, today).balance <= 0) continue;
      const inserted = await prisma.$executeRaw`
        INSERT INTO "RentCharge" ("id", "studentId", "propertyId", "kind", "period", "amount", "dueDate", "description", "createdBy", "updatedAt")
        VALUES (gen_random_uuid()::text, ${c.studentId}, ${c.propertyId}, 'late_fee', ${c.period}, ${settings.lateFeeFlat}, ${new Date(`${today}T00:00:00.000Z`)},
                ${`Late fee: rent for ${monthName(c.period)} unpaid after ${iso(c.dueDate)}`}, 'system', now())
        ON CONFLICT DO NOTHING`;
      if (inserted) {
        created++;
        await notifyStudentUsers(prisma, c.studentId, "Late fee added", `A late fee of ${inr(settings.lateFeeFlat)} was added because rent for ${monthName(c.period)} is overdue.`, "payment", "/student/rent");
      }
    }
  }
  return created;
}

// ── Staff endpoints ──────────────────────────────────────────────────────────
export async function generateNow(auth, actorName, { period, propertyId }) {
  requireRole(auth, "owner", "manager");
  const scopeProperty = auth.role === "manager" ? auth.propertyId : propertyId;
  if (scopeProperty) await assertPropertyAccess(auth, scopeProperty);
  const created = await generateRent({ period: period ?? currentPeriod(), orgId: auth.orgId, propertyId: scopeProperty });
  if (created) {
    await logActivity(prisma, auth, actorName, "payment", `Raised rent for ${monthName(period ?? currentPeriod())}: ${created} new charge${created > 1 ? "s" : ""}`, scopeProperty ?? null, "/manager/payments");
  }
  return { created };
}

/** Deposit or one-off charge (damage, key replacement, ...). */
export async function createCharge(auth, actorName, input) {
  requireRole(auth, "owner", "manager");
  const s = await prisma.studentProfile.findUnique({ where: { id: input.studentId } });
  if (!s) throw notFound("Student");
  await assertPropertyAccess(auth, s.propertyId);
  if (s.status === "moved_out" && input.kind === "deposit") throw conflict("This resident has moved out.");
  const e = {};
  if (!(input.amount > 0)) e.amount = "Amount must be greater than zero";
  if (input.kind === "other" && !input.description?.trim()) e.description = "Describe what this charge is for";
  if (Object.keys(e).length) throw invalid(e);

  const dueDate = input.dueDate ?? todayISO();
  try {
    return await prisma.$transaction(async (tx) => {
      const c = await tx.rentCharge.create({
        data: {
          studentId: s.id, propertyId: s.propertyId, kind: input.kind, period: dueDate.slice(0, 7), amount: input.amount,
          dueDate: new Date(`${dueDate}T00:00:00.000Z`), createdBy: actorName,
          description: input.description?.trim() || (input.kind === "deposit" ? "Security deposit (refundable)" : "Charge"),
        },
      });
      await logActivity(tx, auth, actorName, "payment", `Added ${input.kind === "deposit" ? "security deposit" : "charge"} of ${inr(input.amount)} for ${s.name}`, s.propertyId, `/manager/students/${s.id}`);
      await notifyStudentUsers(tx, s.id, input.kind === "deposit" ? "Security deposit due" : "New charge", `${c.description}: ${inr(input.amount)}, due ${dueDate}.`, "payment", "/student/rent");
      return { ...c, dueDate: iso(c.dueDate) };
    });
  } catch (err) {
    if (err?.code === "P2002" || /RentCharge_one_deposit/.test(String(err?.message))) throw conflict("This resident already has a security deposit charge. Adjust it instead.");
    throw err;
  }
}

/**
 * Corrects a charge (waive part of it, fix the due date). The amount can never go
 * below what has already been paid against it. A reason is required and logged.
 */
export async function adjustCharge(auth, actorName, id, { amount, dueDate, description, reason }) {
  requireRole(auth, "owner", "manager");
  const found = await prisma.rentCharge.findUnique({ where: { id } });
  if (!found) throw notFound("Charge");
  await assertPropertyAccess(auth, found.propertyId);
  if (!reason?.trim()) throw invalid({ reason: "Give a reason for the change" });

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "RentCharge" WHERE "id" = ${id} FOR UPDATE`;
    const charge = await tx.rentCharge.findUnique({ where: { id } });
    const paid = withBalance(charge, await ledgerRows(tx, { chargeId: id }), todayISO()).paid;
    if (amount !== undefined && amount < paid) throw invalid({ amount: `Amount cannot be less than the ${inr(paid)} already paid` });
    const updated = await tx.rentCharge.update({
      where: { id },
      data: {
        ...(amount !== undefined ? { amount } : {}),
        ...(dueDate ? { dueDate: new Date(`${dueDate}T00:00:00.000Z`) } : {}),
        ...(description?.trim() ? { description: description.trim() } : {}),
      },
    });
    const st = await tx.studentProfile.findUnique({ where: { id: charge.studentId }, select: { name: true } });
    const what = amount !== undefined && amount !== charge.amount ? `from ${inr(charge.amount)} to ${inr(amount)}` : "details";
    await logActivity(tx, auth, actorName, "payment", `Adjusted ${st.name}'s ${charge.kind.replace("_", " ")} for ${charge.period} ${what}: ${reason.trim()}`, charge.propertyId, `/manager/students/${charge.studentId}`);
    if (amount !== undefined && amount !== charge.amount) {
      await notifyStudentUsers(tx, charge.studentId, "Due updated", `Your ${charge.kind.replace("_", " ")} for ${charge.period} is now ${inr(amount)}.`, "payment", "/student/rent");
    }
    return { ...updated, dueDate: iso(updated.dueDate) };
  });
}
