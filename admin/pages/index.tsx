import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { useState } from "react";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { isAllowed } from "@/lib/allowlist";
import { prisma } from "@/lib/prisma";

type Org = {
  id: string;
  name: string;
  planId: string;
  createdAt: string;
  userCount: number;
  owner: { name: string; email: string } | null;
  disabled: boolean;
};

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.email || !isAllowed(session.user.email)) {
    return { redirect: { destination: "/api/auth/signin", permanent: false } };
  }

  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: { users: { where: { role: "owner" }, select: { name: true, email: true, disabledAt: true } } },
  });
  const rows: Org[] = await Promise.all(
    orgs.map(async (org) => {
      const userCount = await prisma.user.count({ where: { orgId: org.id } });
      const owner = org.users[0] ?? null;
      return {
        id: org.id,
        name: org.name,
        planId: org.planId,
        createdAt: org.createdAt.toISOString(),
        userCount,
        owner: owner ? { name: owner.name, email: owner.email } : null,
        disabled: Boolean(owner?.disabledAt),
      };
    })
  );

  return { props: { orgs: rows } };
};

export default function Dashboard({ orgs }: { orgs: Org[] }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(org: Org) {
    setBusyId(org.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/${org.disabled ? "reactivate" : "offboard"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: org.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      router.replace(router.asPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main>
      <header>
        <h1>StayPookie — Customers</h1>
        <div>
          <span style={{ fontSize: 13, marginRight: 12 }}>{session?.user?.email}</span>
          <button className="ghost" onClick={() => signOut()}>Sign out</button>
        </div>
      </header>

      <Link href="/onboard"><button>+ Onboard new customer</button></Link>
      {error && <p className="error">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Organization</th>
            <th>Owner</th>
            <th>Users</th>
            <th>Plan</th>
            <th>Status</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {orgs.map((org) => (
            <tr key={org.id}>
              <td>{org.name}</td>
              <td>{org.owner ? `${org.owner.name} (${org.owner.email})` : "—"}</td>
              <td>{org.userCount}</td>
              <td>{org.planId}</td>
              <td>
                <span className={`badge ${org.disabled ? "disabled" : "active"}`}>
                  {org.disabled ? "Disabled" : "Active"}
                </span>
              </td>
              <td>{new Date(org.createdAt).toLocaleDateString()}</td>
              <td>
                <button
                  className={org.disabled ? "" : "secondary"}
                  disabled={busyId === org.id}
                  onClick={() => toggle(org)}
                >
                  {org.disabled ? "Reactivate" : "Offboard"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
