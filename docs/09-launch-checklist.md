# 09 — Launch Checklist

**Public go-live:** 11 Nov 2026, 1:00 PM IST · **Team cutoff:** 10 Nov 2026, 11:59 PM IST

The app runs locally, the frontend builds clean, and **every module is already
built** (see [03-roadmap.md](03-roadmap.md) — the module-by-module plan this
checklist originally assumed turned out unnecessary; PR #35 landed all 22
modules at once). What's left is **not building — it's deploying and
verifying** a product that already works end-to-end locally.

> Scope note: "users can use the platform completely" at launch means the
> **whole product**, not a cut-down core — see D-0005 in
> [06-decisions.md](06-decisions.md), updated once the full build landed.

## Pawan / your side (only you can do these)

- [ ] **Payments decision:** go live with **real Razorpay** (needs your account +
      KYC: live keys, enable live mode, and a public webhook URL configured in the
      Razorpay dashboard) **or** launch with **offline recording** (staff record
      cash/UPI; online "pay now" off). Online payments cannot go live without the
      webhook.
- [ ] **Hosting accounts** — frontend (Netlify/Vercel) and backend (Render/Railway/
      Fly). Create them or give the team access.
- [ ] **Domain / DNS** — point the launch domain at the two deployments.
- [ ] **Production database** — confirm the live Neon DB is the one to launch on,
      and that it's clean (no leftover local-test rows). Decide D-0003 (a separate
      dev DB) so testing stops writing to prod.
- [ ] **First owner** — confirm the real org/owner for the production seed, and set
      a **strong owner password** (the current placeholder is weak). Remove the
      owner env vars after seeding.
- [ ] **Review the docs** — the whole `docs/` folder and the `[review]` lines in
      [01-vision.md](01-vision.md).

## Team side (deploy + wire + verify)

- [ ] **Deploy the backend** to a Node host; set the production env vars:
      `NODE_ENV`, `DATABASE_URL`, `DIRECT_URL`, both JWT secrets (>=32 chars,
      different), `APP_TIMEZONE`, `PAYMENT_MODE`, Razorpay keys, and
      **`CORS_ORIGINS` = the deployed frontend URL** (not `localhost`, not `*`).
- [ ] **Run migrations on prod:** `npm run prisma:deploy`, then the production seed.
- [ ] **Deploy the frontend** (Netlify/Vercel); set **`VITE_API_BASE_URL` = the
      deployed API URL** (not `localhost:4000`).
- [ ] **Add a real `/health` route** on the API for uptime checks (currently 404s).
- [ ] **Smoke-test production:** load the site, log in as each role (owner/
      manager/student), add a property/room/bed, assign a student, record a
      payment, open a receipt — then click through at least complaints, leave
      and one more module per role, since all of them are now live.
- [ ] **Run the backend test suite** (`npm test`, needs the test DB) and confirm green.
- [ ] If payments go live: **test one small real payment** end-to-end and confirm
      the webhook marks it paid.

## Go-live steps (11 Nov, before 1 PM)

1. Final deploy of both apps with production env.
2. Confirm owner can log in on the production URL.
3. Confirm CORS: frontend talks to the API with no console errors.
4. If online payments: one real test transaction + webhook confirmation.
5. Hand the URL + owner credentials to the first hostel.

## Boot-time config guards (so prod won't start misconfigured)

The backend **refuses to start in production** if any of these are wrong
(`backend/src/config/env.js`):

- `PAYMENT_MODE=simulated` is rejected in production.
- `razorpay` mode requires all three Razorpay keys.
- Live keys require live mode to be explicitly enabled.
- JWT secrets must be >=32 chars, not placeholders, and different from each other.
- `CORS_ORIGINS` must be set and must not be `*`.

_Last reviewed: 2026-11-08_
