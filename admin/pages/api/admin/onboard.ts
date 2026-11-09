import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { isEmail, isIndianPhone, normalizePhone } from "@/lib/validators";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== "POST") return res.status(405).end();

  const { orgName, ownerName, ownerEmail, ownerPhone, ownerPassword } = req.body || {};
  const problems: string[] = [];
  if (!orgName || String(orgName).trim().length < 2) problems.push("Organization name is required");
  if (!ownerName || String(ownerName).trim().length < 2) problems.push("Owner name is required");
  if (!isEmail(String(ownerEmail || ""))) problems.push("Owner email is invalid");
  if (!isIndianPhone(String(ownerPhone || ""))) problems.push("Owner phone must be a 10-digit Indian mobile number");
  if (!ownerPassword || String(ownerPassword).length < 12) problems.push("Owner password must be at least 12 characters");
  if (problems.length) return res.status(400).json({ error: problems.join("; ") });

  const email = String(ownerEmail).trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: `A user with email ${email} already exists` });

  const passwordHash = await bcrypt.hash(String(ownerPassword), 12);
  const org = await prisma.$transaction(async (tx) => {
    const o = await tx.organization.create({ data: { name: String(orgName).trim() } });
    await tx.user.create({
      data: {
        orgId: o.id,
        name: String(ownerName).trim(),
        email,
        phone: normalizePhone(String(ownerPhone)),
        role: "owner",
        title: "Owner",
        passwordHash,
      },
    });
    return o;
  });

  res.status(201).json({ orgId: org.id, name: org.name, ownerEmail: email });
}
