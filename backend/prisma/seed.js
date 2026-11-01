import "dotenv/config"; // plain `node` does not read .env (the Prisma CLI does)
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Demo data uses a shared, publicly documented password. Never run it against production.
if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run the demo seed with NODE_ENV=production. Use `npm run db:seed:prod` to create the first owner.");
  process.exit(1);
}

const prisma = new PrismaClient();
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "meraki@123";
const TZ = process.env.APP_TIMEZONE || "Asia/Kolkata";

const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const date = (iso) => new Date(`${iso}T00:00:00.000Z`);
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
function monthsAgoPeriod(n) {
  // Whole-month arithmetic: Date#setMonth overflows (31 Mar - 1 month lands in March).
  const idx = Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7)) - 1 - n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}
const dueDateFor = (period, day = 5) => date(`${period}-${String(day).padStart(2, "0")}`);
const hoursAgo = (h) => new Date(Date.now() - h * 36e5);
let receiptSeq = 0;
const receiptNo = () => `RCPT-${today.slice(0, 4)}-${String(++receiptSeq).padStart(4, "0")}`;

const RESIDENTS = [
  ["Aarav Sharma", "male", "DU", "B.Com", 2],
  ["Ishita Verma", "female", "Amity", "BBA", 1],
  ["Rohan Mehta", "male", "DTU", "B.Tech", 3],
  ["Sneha Iyer", "female", "JNU", "MA", 1],
  ["Kabir Singh", "male", "NSUT", "B.Tech", 2],
  ["Ananya Rao", "female", "DU", "B.Sc", 3],
  ["Vikram Nair", "male", "IIT Delhi", "M.Tech", 1],
];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const org = await prisma.organization.create({
    data: {
      name: "Demo Hostels", planId: "growth",
      settings: { legalName: "Demo Hostels Pvt Ltd", contactEmail: "office@demohostels.example", contactPhone: "9876500000", address: "Plot 12, Sector 45, Gurugram", rentDueDay: 5, lateFeeFlat: 200, lateFeeGraceDays: 3, prorateFirstMonth: true },
    },
  });

  const property = await prisma.property.create({
    data: {
      orgId: org.id, name: "Crown Residency", code: "CROWN", type: "coed", status: "active",
      city: "Gurugram", locality: "Sector 45", address: "Plot 12, Sector 45, Gurugram",
      pincode: "122003", phone: "9876500000", baseRent: 9500, amenities: ["wifi", "laundry", "mess"],
      openedOn: date("2024-06-01"), imageVariant: 1,
    },
  });
  const second = await prisma.property.create({
    data: {
      orgId: org.id, name: "Maple House", code: "MAPLE", type: "girls", status: "active",
      city: "Gurugram", locality: "Sector 56", address: "House 7, Sector 56, Gurugram",
      pincode: "122011", phone: "9876500100", baseRent: 11000, amenities: ["wifi", "ac", "gym"],
      openedOn: date("2025-02-01"), imageVariant: 3,
    },
  });

  const manager = await prisma.staffMember.create({
    data: { orgId: org.id, name: "Priya Menon", role: "manager", propertyId: property.id, phone: "9876500001", email: "priya@crown.in", shift: "general", status: "active", joinedOn: date("2024-06-05") },
  });
  await prisma.property.update({ where: { id: property.id }, data: { managerStaffId: manager.id } });
  const staff = {};
  for (const [name, role, shift, phone] of [["Ramesh Kumar", "maintenance", "morning", "9876500002"], ["Sunita Devi", "housekeeping", "morning", "9876500003"], ["Harish Yadav", "security", "night", "9876500004"], ["Meena Joshi", "warden", "evening", "9876500005"]]) {
    staff[role] = await prisma.staffMember.create({ data: { orgId: org.id, name, role, propertyId: property.id, phone, email: "", shift, status: "active", joinedOn: date("2024-07-01") } });
  }
  await prisma.staffMember.create({ data: { orgId: org.id, name: "Kavita Arora", role: "manager", propertyId: second.id, phone: "9876500101", email: "kavita@maple.in", shift: "general", status: "active", joinedOn: date("2025-02-01") } });

  // Rooms: three floors, mixed types. Beds labelled A–D.
  const beds = [];
  const rooms = [];
  for (const [number, floor, type, rent, ac] of [["101", 1, "double", 9500, true], ["102", 1, "triple", 8000, false], ["201", 2, "double", 9500, true], ["202", 2, "single", 12500, true], ["301", 3, "quad", 7000, false]]) {
    const room = await prisma.room.create({ data: { propertyId: property.id, number, floor, type, rent, ac, attachedBath: ac, status: "active" } });
    rooms.push(room);
    const n = { single: 1, double: 2, triple: 3, quad: 4 }[type];
    for (const label of ["A", "B", "C", "D"].slice(0, n)) beds.push({ room, bed: await prisma.bed.create({ data: { roomId: room.id, propertyId: property.id, label, status: "available" } }) });
  }
  for (const [number, floor, type, rent] of [["G1", 0, "double", 11000], ["G2", 0, "double", 11000]]) {
    const room = await prisma.room.create({ data: { propertyId: second.id, number, floor, type, rent, ac: true, attachedBath: true, status: "active" } });
    for (const label of ["A", "B"]) await prisma.bed.create({ data: { roomId: room.id, propertyId: second.id, label, status: "available" } });
  }
  await prisma.bed.update({ where: { id: beds[beds.length - 1].bed.id }, data: { status: "unavailable", unavailableReason: "Mattress being replaced" } });

  // Residents: each gets a bed; the first is the demo student login.
  const students = [];
  for (const [i, [name, gender, college, course, year]] of RESIDENTS.entries()) {
    const { room, bed } = beds[i];
    const s = await prisma.studentProfile.create({
      data: {
        studentCode: `MRK${String(i + 1).padStart(4, "0")}`, name, email: i === 0 ? "aarav@student.in" : `${name.split(" ")[0].toLowerCase()}@student.in`,
        phone: `98765000${String(10 + i).padStart(2, "0")}`, gender, dob: date(`${2003 + (i % 3)}-0${(i % 9) + 1}-14`), college, course, year,
        propertyId: property.id, roomId: room.id, bedId: bed.id, status: i === 6 ? "notice" : "active",
        joinedOn: date(i < 5 ? "2024-07-01" : `${monthsAgoPeriod(1)}-12`), monthlyRent: room.rent, address: "Delhi", bloodGroup: ["O+", "B+", "A+", "AB+"][i % 4],
        guardianName: `Parent of ${name.split(" ")[0]}`, guardianRelation: "Father", guardianPhone: `98765001${String(10 + i).padStart(2, "0")}`,
        emergencyName: `Parent of ${name.split(" ")[0]}`, emergencyPhone: `98765001${String(10 + i).padStart(2, "0")}`,
      },
    });
    await prisma.bed.update({ where: { id: bed.id }, data: { status: "occupied", studentId: s.id } });
    students.push({ s, room });
  }
  await prisma.studentProfile.create({
    data: {
      studentCode: "MRK0008", name: "Neha Kapoor", email: "neha@student.in", phone: "9876500018", gender: "female", dob: date("2005-02-02"),
      college: "DU", course: "BA", year: 1, propertyId: property.id, status: "pending", joinedOn: date(addDays(today, 10)), monthlyRent: 9500,
    },
  });

  // Users (one per persona) — all use the demo password.
  const ownerUser = await prisma.user.create({ data: { orgId: org.id, name: "Owner Admin", email: "owner@demo.com", phone: "9876500020", role: "owner", title: "Founder", passwordHash } });
  const managerUser = await prisma.user.create({ data: { orgId: org.id, name: "Priya Menon", email: "manager@demo.com", phone: "9876500001", role: "manager", title: "Property Manager", propertyId: property.id, staffId: manager.id, passwordHash } });
  const studentUser = await prisma.user.create({ data: { orgId: org.id, name: "Aarav Sharma", email: "student@demo.com", phone: "9876500010", role: "student", title: "Resident", propertyId: property.id, studentId: students[0].s.id, passwordHash } });

  // Money: three months of rent. Older months mostly paid; the demo student owes
  // last month (overdue) and this month, so "Pay now" and "Record payment" work at once.
  const periods = [monthsAgoPeriod(2), monthsAgoPeriod(1), monthsAgoPeriod(0)];
  for (const { s, room } of students) {
    for (const period of periods) {
      const joined = s.joinedOn.toISOString().slice(0, 10);
      if (joined.slice(0, 7) > period) continue;
      let amount = room.rent;
      let description = `Rent for ${period}`;
      if (joined.slice(0, 7) === period && joined.slice(8) !== "01") {
        const days = new Date(Date.UTC(+period.slice(0, 4), +period.slice(5, 7), 0)).getUTCDate();
        const stay = days - Number(joined.slice(8)) + 1;
        amount = Math.round((room.rent * stay) / days);
        description += ` (pro-rated: ${stay} of ${days} days)`;
      }
      const charge = await prisma.rentCharge.create({ data: { studentId: s.id, propertyId: property.id, kind: "rent", period, amount, dueDate: dueDateFor(period), description } });
      const isDemo = s.id === students[0].s.id;
      const paid = period === periods[0] ? !isDemo : period === periods[1] ? !isDemo && s.name !== "Kabir Singh" : ["Ishita Verma", "Sneha Iyer"].includes(s.name);
      if (paid) {
        await prisma.payment.create({
          data: { chargeId: charge.id, studentId: s.id, propertyId: property.id, amount, method: ["upi", "cash", "bank_transfer"][receiptSeq % 3], status: "captured",
            paidOn: date(`${period}-0${3 + (receiptSeq % 5)}`), reference: `UTR${100000 + receiptSeq}`, receiptNo: receiptNo(), recordedBy: "Priya Menon" },
        });
      }
    }
  }
  const kabir = students.find((x) => x.s.name === "Kabir Singh").s;
  await prisma.rentCharge.create({ data: { studentId: kabir.id, propertyId: property.id, kind: "late_fee", period: periods[1], amount: 200, dueDate: dueDateFor(periods[1], 9), description: `Late fee: rent for ${periods[1]} unpaid` } });
  await prisma.rentCharge.create({ data: { studentId: students[5].s.id, propertyId: property.id, kind: "deposit", period: periods[1], amount: 15000, dueDate: dueDateFor(periods[1], 12), description: "Security deposit (refundable)" } });
  await prisma.counter.upsert({ where: { key: "receipt" }, update: { value: receiptSeq }, create: { key: "receipt", value: receiptSeq } });

  // Resident operations.
  const [aarav, ishita, rohan, sneha] = students.map((x) => x.s);
  const c1 = await prisma.complaint.create({
    data: {
      ticketNo: "CMP-0001", propertyId: property.id, studentId: aarav.id, roomId: aarav.roomId, category: "plumbing", title: "Bathroom tap leaking",
      description: "The tap in the attached bathroom drips all night.", priority: "medium", status: "in_progress", assigneeStaffId: staff.maintenance.id, createdAt: hoursAgo(50),
      history: { create: [{ status: "open", changedBy: "Aarav Sharma", note: "Complaint raised", at: hoursAgo(50) }, { status: "in_progress", changedBy: "Priya Menon", note: "Ramesh will fix it today", at: hoursAgo(30) }] },
      comments: { create: [{ authorUserId: managerUser.id, authorName: "Priya Menon", authorRole: "manager", body: "Washer needs replacing; part ordered.", internal: true, createdAt: hoursAgo(29) }, { authorUserId: managerUser.id, authorName: "Priya Menon", authorRole: "manager", body: "We'll fix it this evening.", internal: false, createdAt: hoursAgo(28) }] },
    },
  });
  await prisma.complaint.create({
    data: { ticketNo: "CMP-0002", propertyId: property.id, studentId: rohan.id, roomId: rohan.roomId, category: "internet", title: "Wi-Fi drops on 2nd floor", description: "Connection drops every few minutes since yesterday.", priority: "high", status: "open", createdAt: hoursAgo(6), history: { create: [{ status: "open", changedBy: "Rohan Mehta", note: "Complaint raised", at: hoursAgo(6) }] } },
  });
  await prisma.complaint.create({
    data: { ticketNo: "CMP-0003", propertyId: property.id, studentId: ishita.id, roomId: ishita.roomId, category: "cleaning", title: "Corridor not cleaned", description: "First floor corridor was skipped on Monday.", priority: "low", status: "resolved", assigneeStaffId: staff.housekeeping.id, createdAt: hoursAgo(120), history: { create: [{ status: "open", changedBy: "Ishita Verma", at: hoursAgo(120) }, { status: "resolved", changedBy: "Priya Menon", note: "Cleaned and schedule fixed", at: hoursAgo(100) }] } },
  });
  await prisma.counter.upsert({ where: { key: "complaint" }, update: { value: 3 }, create: { key: "complaint", value: 3 } });
  void c1;

  await prisma.leaveRequest.create({ data: { studentId: aarav.id, propertyId: property.id, fromDate: date(addDays(today, 5)), toDate: date(addDays(today, 8)), destination: "Jaipur", contactPhone: "9876500110", reason: "Family function", status: "pending" } });
  await prisma.leaveRequest.create({ data: { studentId: sneha.id, propertyId: property.id, fromDate: date(addDays(today, 2)), toDate: date(addDays(today, 4)), destination: "Chandigarh", contactPhone: "9876500113", reason: "Going home", status: "approved", decidedBy: "Priya Menon", decidedAt: hoursAgo(20) } });
  await prisma.visitorRequest.create({ data: { studentId: aarav.id, propertyId: property.id, visitorName: "Rohit Sharma", visitorPhone: "9876500110", relation: "Father", visitDate: date(today), visitTime: "17:30", purpose: "Dropping winter clothes", status: "approved", decidedBy: "Priya Menon", createdBy: "Aarav Sharma" } });
  await prisma.visitorRequest.create({ data: { studentId: rohan.id, propertyId: property.id, visitorName: "Aditya Jain", visitorPhone: "9811122233", relation: "Friend", visitDate: date(addDays(today, 1)), visitTime: "16:00", purpose: "Project work", status: "pending", createdBy: "Rohan Mehta" } });
  for (const [sid, category, rating, comment, anonymous] of [[aarav.id, "food", 4, "Dinner has improved a lot this month.", false], [ishita.id, "cleanliness", 3, "Bathrooms could be cleaned twice a day.", true], [rohan.id, "internet", 2, "Wi-Fi is slow in the evenings.", false], [sneha.id, "staff", 5, "Meena ma'am is very helpful.", false]]) {
    await prisma.feedback.create({ data: { propertyId: property.id, studentId: sid, category, rating, comment, anonymous, createdAt: hoursAgo(rating * 20) } });
  }

  // Property operations.
  await prisma.maintenanceTicket.create({ data: { ticketNo: "MNT-0001", propertyId: property.id, title: "Water heater service", description: "Annual service of the 2nd floor geyser.", category: "appliance", location: "2nd floor washroom", priority: "medium", status: "assigned", assigneeStaffId: staff.maintenance.id, estimatedCost: 1500, createdBy: "Priya Menon" } });
  await prisma.maintenanceTicket.create({ data: { ticketNo: "MNT-0002", propertyId: property.id, title: "Repaint common room", description: "Walls stained after the monsoon.", category: "painting", location: "Common room", priority: "low", status: "open", vendor: "Sharma Painters", estimatedCost: 12000, createdBy: "Priya Menon" } });
  await prisma.counter.upsert({ where: { key: "maintenance" }, update: { value: 2 }, create: { key: "maintenance", value: 2 } });
  for (const [name, sku, category, unit, quantity, reorderLevel, unitCost] of [["Bedsheet (single)", "LIN-001", "linen", "pcs", 42, 20, 350], ["Pillow cover", "LIN-002", "linen", "pcs", 8, 15, 90], ["Floor cleaner", "CLN-001", "cleaning", "litre", 12, 10, 180], ["LED tube light", "ELE-001", "electrical", "pcs", 4, 6, 220]]) {
    const item = await prisma.inventoryItem.create({ data: { propertyId: property.id, name, sku, category, unit, quantity, reorderLevel, unitCost } });
    await prisma.inventoryTransaction.create({ data: { itemId: item.id, propertyId: property.id, type: "in", quantity, note: "Opening stock", by: "Priya Menon" } });
  }
  const notice = await prisma.announcement.create({ data: { propertyId: property.id, title: "Water supply off on Sunday morning", body: "The overhead tank is being cleaned. No water from 8 am to 11 am on Sunday. Please store water on Saturday night.", category: "maintenance", status: "published", author: "Priya Menon", publishedAt: hoursAgo(12) } });
  await prisma.announcement.create({ data: { propertyId: property.id, title: "Diwali dinner", body: "Special dinner in the mess on Diwali night, 8 pm onwards. Everyone is welcome!", category: "event", status: "published", author: "Priya Menon", publishedAt: hoursAgo(60) } });
  await prisma.announcement.create({ data: { propertyId: property.id, title: "New mess menu (draft)", body: "Draft of next month's menu.", category: "mess", status: "draft", author: "Priya Menon" } });
  await prisma.announcementRead.create({ data: { announcementId: notice.id, studentId: ishita.id } });
  await prisma.hostelEvent.create({ data: { propertyId: property.id, title: "Movie night", description: "Screening in the common room. Popcorn on us.", category: "cultural", date: date(addDays(today, 3)), startTime: "20:00", endTime: "22:30", location: "Common room", capacity: 40, expectedAttendance: 25, status: "scheduled", createdBy: "Priya Menon" } });
  await prisma.hostelEvent.create({ data: { propertyId: property.id, title: "Health check-up camp", description: "Free BP, sugar and eye check-up.", category: "health", date: date(addDays(today, 9)), startTime: "10:00", endTime: "13:00", location: "Reception", capacity: 60, expectedAttendance: 30, status: "scheduled", createdBy: "Priya Menon" } });

  // History for the analytics trend before this month.
  for (const [k, period] of periods.slice(0, 2).entries()) {
    await prisma.monthlySnapshot.create({ data: { propertyId: property.id, period, beds: beds.length, occupiedBeds: 5 + k, occupancyPct: Math.round(((5 + k) / beds.length) * 100), expected: 47500 + k * 15000, collected: 47500 + k * 5500, arrears: k * 9500, complaints: 2 + k } });
  }

  await prisma.activityLog.createMany({
    data: [
      { orgId: org.id, propertyId: property.id, actorName: "Priya Menon", actorRole: "manager", category: "payment", message: "Recorded ₹9,500 UPI payment from Ishita Verma", link: "/manager/payments", createdAt: hoursAgo(3) },
      { orgId: org.id, propertyId: property.id, actorName: "Rohan Mehta", actorRole: "student", category: "complaint", message: "Rohan Mehta raised complaint CMP-0002: Wi-Fi drops on 2nd floor", link: "/manager/complaints", createdAt: hoursAgo(6) },
      { orgId: org.id, propertyId: property.id, actorName: "Priya Menon", actorRole: "manager", category: "announcement", message: "Published notice: Water supply off on Sunday morning", link: "/manager/announcements", createdAt: hoursAgo(12) },
    ],
  });
  await prisma.notification.createMany({
    data: [
      { recipientUserId: studentUser.id, title: "Rent due", body: `Rent for ${periods[2]} is due by the 5th.`, category: "payment", link: "/student/rent" },
      { recipientUserId: managerUser.id, title: "New complaint", body: "CMP-0002 · Wi-Fi drops on 2nd floor (Rohan Mehta)", category: "complaint", link: "/manager/complaints" },
      { recipientUserId: ownerUser.id, title: "Low stock", body: "Pillow cover and LED tube light are at or below their reorder level at Crown Residency.", category: "inventory", link: "/owner/inventory" },
    ],
  });

  console.log("Seeded. Demo logins (password: " + DEMO_PASSWORD + "):");
  console.log("  owner@demo.com · manager@demo.com · student@demo.com");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
