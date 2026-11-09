import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== "GET") return res.status(405).end();

  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: { users: { where: { role: "owner" }, select: { id: true, name: true, email: true, disabledAt: true } } },
  });

  const rows = await Promise.all(
    orgs.map(async (org) => {
      const userCount = await prisma.user.count({ where: { orgId: org.id } });
      const owner = org.users[0] ?? null;
      return {
        id: org.id,
        name: org.name,
        planId: org.planId,
        createdAt: org.createdAt,
        userCount,
        owner: owner ? { name: owner.name, email: owner.email } : null,
        disabled: Boolean(owner?.disabledAt),
      };
    })
  );

  res.status(200).json({ orgs: rows });
}
