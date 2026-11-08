# 09 — Launch Checklist

**Public go-live:** 11 Nov 2026, 1 PM IST · **Team cutoff:** 10 Nov 2026, 11:59 PM IST

Everything is built (PR #35 landed all 22 modules). What's left is
**deploying and verifying**, not building.

> "Users can use the platform completely" means the **whole product** — see D-0005.

## Pawan only

- [ ] **Payments:** real Razorpay (live keys, live mode, public webhook URL) or offline-recording only. Online pay-now needs the webhook.
- [ ] **Hosting accounts** — frontend (Netlify/Vercel), backend (Render/Railway/Fly). Create or share access.
- [ ] **Domain/DNS** → the two deployments.
- [ ] **Production DB** — confirm the live Neon DB is launch-ready, no leftover test rows. Decide D-0003 so testing stops writing to prod.
- [ ] **First owner** — confirm the real org/owner, set a strong password, remove the seed owner env vars after.
- [ ] **Review the docs** — the `[review]` lines in [01-vision.md](01-vision.md).

## Team — deploy + wire + verify

- [ ] Deploy backend; set prod env vars: `NODE_ENV`, `DATABASE_URL`, `DIRECT_URL`, two distinct JWT secrets (≥32 chars), `APP_TIMEZONE`, `PAYMENT_MODE`, Razorpay keys, `CORS_ORIGINS` = the deployed frontend URL (not `localhost`/`*`).
- [ ] Run `npm run prisma:deploy`, then the production seed.
- [ ] Deploy frontend; set `VITE_API_BASE_URL` = the deployed API.
- [ ] Smoke-test prod: log in as each role, add property/room/bed, assign a student, record a payment, open a receipt, click through complaints/leave + one more module per role.
- [ ] Run `npm test` against the test DB, confirm green.
- [ ] If payments go live: one real small transaction, confirm the webhook marks it paid.

## Go-live (11 Nov, before 1 PM)

1. Final deploy of both apps with production env.
2. Confirm owner can log in on the production URL.
3. Confirm CORS — no console errors.
4. If online payments: one real test transaction + webhook confirmation.
5. Hand the URL + owner credentials to the first hostel.

## Boot-time guards (backend refuses to start misconfigured)

`PAYMENT_MODE=simulated` rejected in prod · `razorpay` mode requires all
three keys · live keys require live mode explicitly enabled · JWT secrets
≥32 chars, not placeholders, distinct · `CORS_ORIGINS` set and not `*`.

_Last reviewed: 2026-11-08_
