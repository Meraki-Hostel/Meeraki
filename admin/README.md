# admin — StayPookie internal admin panel

Internal-only tool for the StayPookie team to onboard and offboard customer
organizations. Independent app (own `package.json`), reads/writes the **same**
production Postgres database as `backend/`, but only ever runs `prisma generate`
against its own trimmed `prisma/schema.prisma` (Organization + User only) —
never `prisma migrate` here. `backend/` remains the sole owner of migrations.

Not linked to from the public product. Access is gated by Google sign-in
restricted to `ADMIN_EMAIL_ALLOWLIST`.

## Setup

```bash
cd admin
npm install
cp .env.example .env   # fill in DATABASE_URL/DIRECT_URL (same Neon DB as backend),
                        # GOOGLE_CLIENT_ID/SECRET, NEXTAUTH_SECRET, ADMIN_EMAIL_ALLOWLIST
npm run prisma:generate
npm run dev             # http://localhost:3000
```

Google OAuth client: Google Cloud Console → APIs & Services → Credentials →
Create Credentials → OAuth client ID → Web application. Add authorized
redirect URI `http://localhost:3000/api/auth/callback/google` for local dev,
and `https://<deployed-url>/api/auth/callback/google` once deployed.

## What it does

- **Onboard** (`/onboard`): creates a new `Organization` + its first `owner`
  user. Refuses only if the owner email is already taken — never touches any
  other organization's data.
- **Dashboard** (`/`): lists every organization, its owner, user count, plan,
  and active/disabled status.
- **Offboard**: soft-disables a customer by setting `disabledAt` on every user
  in that organization. `backend`'s `authenticate` middleware and login both
  already refuse `disabledAt` users, so this takes effect immediately. No data
  is deleted. **Reactivate** clears it again.

## Deploy

Deploys like any Next.js app (e.g. Vercel, or Render as a Node web service:
build `npm ci && npm run build`, start `npm start`). Root directory `admin`.
Set the same env vars as `.env.example`, with `NEXTAUTH_URL` and the Google
OAuth redirect URI updated to the deployed URL. Keep this app private — don't
link it from the public product, and don't widen `ADMIN_EMAIL_ALLOWLIST`
without confirming with the team.
