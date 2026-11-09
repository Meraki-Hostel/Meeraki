import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth";
import { isAllowed } from "./allowlist";

export async function requireAdmin(req: NextApiRequest, res: NextApiResponse): Promise<string | null> {
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email || !isAllowed(email)) {
    res.status(401).json({ error: "Not signed in as an allowed StayPookie admin" });
    return null;
  }
  return email;
}
