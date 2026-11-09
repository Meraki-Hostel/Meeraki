import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";

// Soft-disable: sets disabledAt on every user in the org. authenticate middleware
// and login both already refuse disabledAt users (backend/src/middleware/authenticate.js),
// so this takes effect immediately without touching any other data. Reversible via /reactivate.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== "POST") return res.status(405).end();

  const { orgId } = req.body || {};
  if (!orgId) return res.status(400).json({ error: "orgId is required" });

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return res.status(404).json({ error: "Organization not found" });

  const result = await prisma.user.updateMany({
    where: { orgId, disabledAt: null },
    data: { disabledAt: new Date() },
  });

  res.status(200).json({ orgId, disabledUsers: result.count });
}
