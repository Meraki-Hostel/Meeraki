import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "meraki@123";

function monthsAgoPeriod(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 7);
}
function dueDateFor(period, day = 5) {
  return new Date(`${period}-${String(day).padStart(2, "0")}T00:00:00.000Z`);
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const property = await prisma.property.create({
    data: {
      name: "Crown Residency", code: "CROWN", type: "coed", status: "active",
      city: "Gurugram", locality: "Sector 45", address: "Plot 12, Sector 45, Gurugram",
      pincode: "122003", phone: "9876500000", baseRent: 9500, amenities: ["wifi", "laundry", "mess"],
      openedOn: new Date("2024-06-01"), imageVariant: 1,
    },
  });

  const manager = await prisma.staffMember.create({
    data: { name: "Priya Menon", role: "manager", propertyId: property.id, phone: "9876500001", email: "priya@crown.in", shift: "general", status: "active", joinedOn: new Date("2024-06-05") },
  });
  await prisma.property.update({ where: { id: property.id }, data: { managerStaffId: manager.id } });

  const room = await prisma.room.create({
    data: { propertyId: property.id, number: "101", floor: 1, type: "double", rent: 9500, ac: true, attachedBath: true, status: "active" },
  });
  const bedA = await prisma.bed.create({ data: { roomId: room.id, propertyId: property.id, label: "A", status: "available" } });
  await prisma.bed.create({ data: { roomId: room.id, propertyId: property.id, label: "B", status: "available" } });

  const student = await prisma.studentProfile.create({
    data: {
      studentCode: "MRK0001", name: "Aarav Sharma", email: "aarav@student.in", phone: "9876500010",
      gender: "male", dob: new Date("2004-03-14"), college: "DU", course: "B.Com", year: 2,
      propertyId: property.id, roomId: room.id, bedId: bedA.id, status: "active",
      joinedOn: new Date("2024-07-01"), monthlyRent: 9500, address: "Delhi",
      guardianName: "Rohit Sharma", guardianRelation: "Father", guardianPhone: "9876500011",
      emergencyName: "Rohit Sharma", emergencyPhone: "9876500011",
    },
  });
  await prisma.bed.update({ where: { id: bedA.id }, data: { status: "occupied", studentId: student.id } });

  // Users (one per persona) — all use the demo password.
  await prisma.user.create({ data: { name: "Owner Admin", email: "owner@demo.com", phone: "9876500020", role: "owner", title: "Founder", passwordHash } });
  await prisma.user.create({ data: { name: "Priya Menon", email: "manager@demo.com", phone: "9876500001", role: "manager", title: "Property Manager", propertyId: property.id, staffId: manager.id, passwordHash } });
  await prisma.user.create({ data: { name: "Aarav Sharma", email: "student@demo.com", phone: "9876500010", role: "student", title: "Resident", propertyId: property.id, studentId: student.id, passwordHash } });

  // Rent charges: last month (unpaid → overdue) and this month (unpaid). Lets
  // the student "Pay now" and staff "Record payment" immediately.
  const prev = monthsAgoPeriod(1);
  const curr = monthsAgoPeriod(0);
  await prisma.rentCharge.create({ data: { studentId: student.id, propertyId: property.id, period: prev, amount: 9500, dueDate: dueDateFor(prev), description: `Rent ${prev}` } });
  await prisma.rentCharge.create({ data: { studentId: student.id, propertyId: property.id, period: curr, amount: 9500, dueDate: dueDateFor(curr), description: `Rent ${curr}` } });

  await prisma.counter.upsert({ where: { key: "receipt" }, update: {}, create: { key: "receipt", value: 0 } });

  console.log("Seeded. Demo logins (password: " + DEMO_PASSWORD + "):");
  console.log("  owner@demo.com · manager@demo.com · student@demo.com");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
