import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { useRouter } from "next/router";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { isAllowed } from "@/lib/allowlist";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.email || !isAllowed(session.user.email)) {
    return { redirect: { destination: "/api/auth/signin", permanent: false } };
  }
  return { props: {} };
};

export default function Onboard() {
  const router = useRouter();
  const [form, setForm] = useState({ orgName: "", ownerName: "", ownerEmail: "", ownerPhone: "", ownerPassword: "" });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function update(field: keyof typeof form) {
    return (e: FormEvent<HTMLInputElement>) => setForm({ ...form, [field]: e.currentTarget.value });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setSuccess(`Created "${data.name}" with owner ${data.ownerEmail}. Redirecting...`);
      setTimeout(() => router.push("/"), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <header>
        <h1>Onboard new customer</h1>
        <Link href="/">&larr; Back</Link>
      </header>

      <form onSubmit={submit}>
        <label>Organization / hostel name</label>
        <input value={form.orgName} onChange={update("orgName")} required />

        <label>Owner name</label>
        <input value={form.ownerName} onChange={update("ownerName")} required />

        <label>Owner email</label>
        <input type="email" value={form.ownerEmail} onChange={update("ownerEmail")} required />

        <label>Owner phone (10-digit Indian mobile)</label>
        <input value={form.ownerPhone} onChange={update("ownerPhone")} required />

        <label>Owner password (12+ characters — share with the customer securely, then they should change it)</label>
        <input type="text" value={form.ownerPassword} onChange={update("ownerPassword")} required />

        <div style={{ marginTop: 20 }}>
          <button type="submit" disabled={busy}>{busy ? "Creating..." : "Create organization + owner"}</button>
        </div>
        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}
      </form>
    </main>
  );
}
