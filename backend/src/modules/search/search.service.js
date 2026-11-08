import { prisma } from "../../config/prisma.js";

const LIMIT = 5;
const like = (q) => ({ contains: q, mode: "insensitive" });

// Navigation pages per role (mirrors staypookie-frontend/src/components/layout/nav.ts).
const PAGES = {
  owner: [["Dashboard", "/owner/dashboard"], ["Properties", "/owner/properties"], ["Analytics", "/owner/analytics"], ["Finance", "/owner/finance"],
    ["Staff", "/owner/staff"], ["Complaints", "/owner/complaints"], ["Events", "/owner/events"], ["Inventory", "/owner/inventory"],
    ["Plans", "/owner/plans"], ["Settings", "/owner/settings"]],
  manager: [["Dashboard", "/manager/dashboard"], ["Rooms & beds", "/manager/rooms"], ["Students", "/manager/students"], ["Payments", "/manager/payments"],
    ["Complaints", "/manager/complaints"], ["Leave", "/manager/leave"], ["Visitors", "/manager/visitors"], ["Maintenance", "/manager/maintenance"],
    ["Inventory", "/manager/inventory"], ["Staff", "/manager/staff"], ["Announcements", "/manager/announcements"], ["Events", "/manager/events"],
    ["Feedback", "/manager/feedback"], ["Activity", "/manager/activity"]],
  student: [["Home", "/student/home"], ["Rent & receipts", "/student/rent"], ["Notices", "/student/notices"], ["Complaints", "/student/complaints"],
    ["Leave", "/student/leave"], ["Visitors", "/student/visitors"], ["Profile", "/student/profile"], ["Documents", "/student/documents"],
    ["Feedback", "/student/feedback"], ["Emergency", "/student/emergency"]],
};

function pages(role, q) {
  const needle = q.toLowerCase();
  return [...PAGES[role], ["Help & support", "/help"], ["Notifications", "/notifications"], ["My profile", "/profile"]]
    .filter(([label]) => label.toLowerCase().includes(needle))
    .slice(0, LIMIT)
    .map(([label, link]) => ({ id: `page:${link}`, kind: "page", title: label, subtitle: "Go to page", link }));
}

/** Does a published notice reach this student (whole hostel, their floor or their room)? */
function reaches(a, room) {
  if (a.audienceType === "all") return true;
  if (!room) return false;
  if (a.audienceType === "floors") return a.audienceValues.includes(String(room.floor));
  return a.audienceValues.includes(room.number) || a.audienceValues.includes(room.id);
}

async function forStudent(auth, q) {
  const s = await prisma.studentProfile.findUnique({ where: { id: auth.studentId }, select: { propertyId: true, roomId: true } });
  const room = s.roomId ? await prisma.room.findUnique({ where: { id: s.roomId } }) : null;
  const [payments, notices] = await Promise.all([
    prisma.payment.findMany({ where: { studentId: auth.studentId, status: { in: ["captured", "simulated"] }, receiptNo: like(q) }, take: LIMIT, orderBy: { paidOn: "desc" } }),
    prisma.announcement.findMany({ where: { propertyId: s.propertyId, status: "published", title: like(q) }, take: 20, orderBy: { publishedAt: "desc" } }),
  ]);
  return [
    ...payments.map((p) => ({ id: p.id, kind: "payment", title: p.receiptNo, subtitle: `₹${p.amount.toLocaleString("en-IN")} · ${p.paidOn.toISOString().slice(0, 10)}`, link: "/student/rent" })),
    ...notices.filter((a) => reaches(a, room)).slice(0, LIMIT).map((a) => ({ id: a.id, kind: "notice", title: a.title, subtitle: "Notice", link: "/student/notices" })),
    ...pages("student", q),
  ];
}

async function forStaff(auth, q) {
  const owner = auth.role === "owner";
  const scope = owner ? { property: { orgId: auth.orgId } } : { propertyId: auth.propertyId };
  const base = owner ? "/owner" : "/manager";
  const [students, rooms, properties, complaints, staff, notices, payments] = await Promise.all([
    prisma.studentProfile.findMany({ where: { ...scope, OR: [{ name: like(q) }, { studentCode: like(q) }, { phone: { contains: q } }] }, take: LIMIT, orderBy: { name: "asc" }, include: { property: { select: { name: true } } } }),
    prisma.room.findMany({ where: { ...scope, number: like(q) }, take: LIMIT, include: { property: { select: { name: true } } } }),
    owner ? prisma.property.findMany({ where: { orgId: auth.orgId, OR: [{ name: like(q) }, { code: like(q) }] }, take: LIMIT }) : [],
    prisma.complaint.findMany({ where: { ...scope, OR: [{ ticketNo: like(q) }, { title: like(q) }] }, take: LIMIT, orderBy: { createdAt: "desc" } }),
    prisma.staffMember.findMany({ where: owner ? { orgId: auth.orgId, name: like(q) } : { propertyId: auth.propertyId, name: like(q) }, take: LIMIT }),
    prisma.announcement.findMany({ where: { ...scope, title: like(q) }, take: LIMIT, orderBy: { createdAt: "desc" } }),
    prisma.payment.findMany({ where: { ...scope, status: { in: ["captured", "simulated"] }, receiptNo: like(q) }, take: LIMIT, orderBy: { paidOn: "desc" } }),
  ]);
  return [
    ...students.map((s) => ({
      id: s.id, kind: "student", title: s.name, subtitle: `${s.studentCode} · ${s.property.name}`,
      link: owner ? `/owner/properties/${s.propertyId}` : `/manager/students/${s.id}`,
    })),
    ...rooms.map((r) => ({ id: r.id, kind: "room", title: `Room ${r.number}`, subtitle: `Floor ${r.floor} · ${r.property.name}`, link: owner ? `/owner/properties/${r.propertyId}` : "/manager/rooms" })),
    ...properties.map((p) => ({ id: p.id, kind: "property", title: p.name, subtitle: `${p.code} · ${p.city}`, link: `/owner/properties/${p.id}` })),
    ...complaints.map((c) => ({ id: c.id, kind: "complaint", title: c.title, subtitle: `${c.ticketNo} · ${c.status.replace("_", " ")}`, link: `${base}/complaints?id=${c.id}` })),
    ...staff.map((s) => ({ id: s.id, kind: "staff", title: s.name, subtitle: s.role, link: `${base}/staff` })),
    ...notices.map((a) => ({ id: a.id, kind: "notice", title: a.title, subtitle: `Notice · ${a.status}`, link: owner ? "/owner/dashboard" : "/manager/announcements" })),
    ...payments.map((p) => ({ id: p.id, kind: "payment", title: p.receiptNo, subtitle: `₹${p.amount.toLocaleString("en-IN")} · ${p.paidOn.toISOString().slice(0, 10)}`, link: owner ? "/owner/finance" : "/manager/payments" })),
    ...pages(auth.role, q),
  ];
}

export async function search(auth, rawQuery) {
  const q = String(rawQuery ?? "").trim();
  if (q.length < 2 || q.length > 60) return [];
  return auth.role === "student" ? forStudent(auth, q) : forStaff(auth, q);
}
