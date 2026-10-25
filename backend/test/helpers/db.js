import "./env.js";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/config/prisma.js";

export { prisma };
export const TEST_PASSWORD = "Test#Passw0rd1";
const HASH = bcrypt.hashSync(TEST_PASSWORD, 4); // low cost: tests only

async function assertTestDatabase() {
  const [{ db }] = await prisma.$queryRaw`SELECT current_database() AS db`;
  if (!String(db).endsWith("_test")) throw new Error(`Refusing to touch database "${db}"`);
}

/** Empties every application table of the (verified) test database. */
export async function resetDb() {
  await assertTestDatabase();
  const rows = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = rows.map((r) => `"${r.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export const disconnect = () => prisma.$disconnect();

let seq = 0;
const n = () => ++seq;

export const makeOrg = (name = `Org ${n()}`) => prisma.organization.create({ data: { name } });

export async function makeProperty(org, code, name = `Hostel ${code}`) {
  return prisma.property.create({
    data: {
      orgId: org.id, name, code, type: "coed", status: "active", city: "Gurugram", locality: "Sector 45",
      address: `Plot ${n()}, Sector 45`, pincode: "122003", phone: "9876500000", baseRent: 9500,
      amenities: ["wifi"], openedOn: new Date("2024-06-01"),
    },
  });
}

export async function makeRoom(property, number, type = "double", labels = ["A", "B"]) {
  const room = await prisma.room.create({
    data: { propertyId: property.id, number, floor: 1, type, rent: 9500, ac: false, attachedBath: false },
  });
  const beds = [];
  for (const label of labels) {
    beds.push(await prisma.bed.create({ data: { roomId: room.id, propertyId: property.id, label } }));
  }
  return { room, beds };
}

export async function makeStudent(property, name, { bed, status } = {}) {
  const i = n();
  const s = await prisma.studentProfile.create({
    data: {
      studentCode: `T${String(i).padStart(4, "0")}`, name, email: `student${i}@example.test`,
      phone: `98765${String(10000 + i).slice(-5)}`, gender: "male", dob: new Date("2004-03-14"),
      college: "Test College", course: "B.Com", year: 2, propertyId: property.id, joinedOn: new Date("2024-07-01"),
      monthlyRent: 9500, status: status ?? (bed ? "active" : "pending"),
      bedId: bed?.id ?? null, roomId: bed?.roomId ?? null,
    },
  });
  if (bed) await prisma.bed.update({ where: { id: bed.id }, data: { status: "occupied", studentId: s.id } });
  return s;
}

export async function makeUser(org, role, name, extra = {}) {
  const i = n();
  return prisma.user.create({
    data: {
      orgId: org.id, name, email: `${role}${i}@example.test`, phone: `98000${String(10000 + i).slice(-5)}`,
      role, title: role, passwordHash: HASH, ...extra,
    },
  });
}

export async function makeCharge(student, period = "2026-01", amount = 9500) {
  return prisma.rentCharge.create({
    data: {
      studentId: student.id, propertyId: student.propertyId, period, amount,
      dueDate: new Date(`${period}-05T00:00:00.000Z`), description: `Rent ${period}`,
    },
  });
}

/**
 * One organization with two hostels (A, B), one manager each, one owner, and residents:
 *   residentA: active, bed A1 (user: studentA), one unpaid rent charge
 *   waitlistA: pending, no bed (no login)
 *   residentB: active, bed B1 (user: studentB)
 */
export async function seedWorld() {
  const org = await makeOrg("Org One");
  const A = await makeProperty(org, "HA", "Hostel A");
  const B = await makeProperty(org, "HB", "Hostel B");
  const roomA = await makeRoom(A, "101", "double", ["A", "B"]);
  const roomA2 = await makeRoom(A, "102", "single", ["A"]);
  const roomB = await makeRoom(B, "201", "double", ["A", "B"]);

  const residentA = await makeStudent(A, "Resident A", { bed: roomA.beds[0] });
  const waitlistA = await makeStudent(A, "Waitlist A");
  const residentB = await makeStudent(B, "Resident B", { bed: roomB.beds[0] });

  const owner = await makeUser(org, "owner", "Owner");
  const managerA = await makeUser(org, "manager", "Manager A", { propertyId: A.id });
  const managerB = await makeUser(org, "manager", "Manager B", { propertyId: B.id });
  const studentA = await makeUser(org, "student", "Resident A", { propertyId: A.id, studentId: residentA.id });
  const studentB = await makeUser(org, "student", "Resident B", { propertyId: B.id, studentId: residentB.id });

  const chargeA = await makeCharge(residentA);
  const chargeB = await makeCharge(residentB);

  return {
    org, A, B, roomA, roomA2, roomB, residentA, waitlistA, residentB,
    users: { owner, managerA, managerB, studentA, studentB },
    chargeA, chargeB,
  };
}

/** Bed / resident consistency violations currently in the database. Empty = consistent. */
export async function bedInvariantViolations() {
  const [beds, students] = await Promise.all([prisma.bed.findMany(), prisma.studentProfile.findMany()]);
  const bad = [];
  for (const b of beds) {
    if (b.status === "occupied" && !b.studentId) bad.push(`bed ${b.label} (${b.id}) is occupied but has no resident`);
    if (b.status !== "occupied" && b.studentId) bad.push(`bed ${b.label} (${b.id}) is ${b.status} but linked to a resident`);
  }
  for (const s of students) {
    if (s.bedId) {
      const bed = beds.find((b) => b.id === s.bedId);
      if (!bed || bed.studentId !== s.id) bad.push(`resident ${s.name} points at a bed that is not linked back`);
      if (s.status === "moved_out") bad.push(`resident ${s.name} is moved_out but still holds a bed`);
    }
  }
  return bad;
}

/**
 * A second, unrelated business: its own owner, hostel X with a manager, a room,
 * a resident with a login and an unpaid charge. Used to prove tenant isolation.
 */
export async function seedOtherOrg() {
  const org = await makeOrg("Org Two");
  const X = await makeProperty(org, "HX", "Hostel X");
  const roomX = await makeRoom(X, "901", "double", ["A", "B"]);
  const residentX = await makeStudent(X, "Resident X", { bed: roomX.beds[0] });
  const ownerX = await makeUser(org, "owner", "Owner X");
  const managerX = await makeUser(org, "manager", "Manager X", { propertyId: X.id });
  const studentX = await makeUser(org, "student", "Resident X", { propertyId: X.id, studentId: residentX.id });
  const chargeX = await makeCharge(residentX);
  const staffX = await prisma.staffMember.create({
    data: { orgId: org.id, name: "Staff X", role: "manager", propertyId: X.id, phone: "9800011111", email: "staffx@example.test", joinedOn: new Date("2025-01-01") },
  });
  return { org, X, roomX, residentX, chargeX, staffX, users: { ownerX, managerX, studentX } };
}
