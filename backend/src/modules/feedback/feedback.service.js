import { prisma } from "../../config/prisma.js";
import { invalid, conflict, forbidden } from "../../utils/ApiError.js";
import { requireRole, propertyScope } from "../../utils/scope.js";
import { logActivity } from "../../utils/sideEffects.js";

const WEEK = 7 * 864e5;
const round1 = (n) => Math.round(n * 10) / 10;

// Staff never see who wrote anonymous feedback: the id and name are replaced.
async function views(rows, { forStaff }) {
  const [students, props] = await Promise.all([
    prisma.studentProfile.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.studentId))] } }, select: { id: true, name: true } }),
    prisma.property.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.propertyId))] } }, select: { id: true, name: true } }),
  ]);
  const sName = new Map(students.map((s) => [s.id, s.name]));
  const pName = new Map(props.map((p) => [p.id, p.name]));
  return rows.map((f) => {
    const hide = forStaff && f.anonymous;
    return {
      id: f.id, propertyId: f.propertyId, studentId: hide ? "" : f.studentId, category: f.category, rating: f.rating,
      comment: f.comment, anonymous: f.anonymous, createdAt: f.createdAt.toISOString(),
      studentName: hide ? "Anonymous" : sName.get(f.studentId) ?? "Resident", propertyName: pName.get(f.propertyId) ?? "—",
    };
  });
}

export async function submit(auth, input) {
  if (auth.role !== "student") throw forbidden("Only residents can give feedback.");
  const e = {};
  if (!(Number.isInteger(input.rating) && input.rating >= 1 && input.rating <= 5)) e.rating = "Choose a rating from 1 to 5 stars";
  if (!input.comment || input.comment.trim().length < 3) e.comment = "Tell us a little more (at least 3 characters)";
  if (Object.keys(e).length) throw invalid(e);

  const s = await prisma.studentProfile.findUnique({ where: { id: auth.studentId }, select: { propertyId: true, name: true } });
  const recent = await prisma.feedback.findFirst({
    where: { studentId: auth.studentId, category: input.category, createdAt: { gt: new Date(Date.now() - WEEK) } }, select: { id: true },
  });
  if (recent) throw conflict("You already gave feedback about this in the last 7 days.");

  const f = await prisma.$transaction(async (tx) => {
    const row = await tx.feedback.create({
      data: { propertyId: s.propertyId, studentId: auth.studentId, category: input.category, rating: input.rating, comment: input.comment.trim(), anonymous: !!input.anonymous },
    });
    const who = input.anonymous ? "Anonymous resident" : s.name;
    await logActivity(tx, auth, who, "feedback", `${who} rated ${input.category} ${input.rating}/5`, s.propertyId, "/manager/feedback");
    return row;
  });
  return (await views([f], { forStaff: false }))[0];
}

export async function mine(auth) {
  if (auth.role !== "student") throw forbidden();
  const rows = await prisma.feedback.findMany({ where: { studentId: auth.studentId }, orderBy: { createdAt: "desc" } });
  return views(rows, { forStaff: false });
}

export async function list(auth, filters = {}) {
  requireRole(auth, "owner", "manager");
  const where = await propertyScope(auth, filters.propertyId);
  if (filters.category) where.category = filters.category;
  const rows = await prisma.feedback.findMany({ where, orderBy: { createdAt: "desc" }, take: 500 });
  return views(rows, { forStaff: true });
}

export async function summary(auth, filters = {}) {
  requireRole(auth, "owner", "manager");
  const where = await propertyScope(auth, filters.propertyId);
  const [all, byCat, byRating] = await Promise.all([
    prisma.feedback.aggregate({ where, _avg: { rating: true }, _count: true }),
    prisma.feedback.groupBy({ by: ["category"], where, _avg: { rating: true }, _count: true }),
    prisma.feedback.groupBy({ by: ["rating"], where, _count: true }),
  ]);
  return {
    average: round1(all._avg.rating ?? 0),
    total: all._count,
    byCategory: byCat.map((g) => ({ category: g.category, average: round1(g._avg.rating ?? 0), count: g._count })).sort((a, b) => b.count - a.count),
    distribution: [1, 2, 3, 4, 5].map((rating) => ({ rating, count: byRating.find((g) => g.rating === rating)?._count ?? 0 })),
  };
}
