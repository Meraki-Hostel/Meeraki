# Meraki API

REST API for the Meraki hostel-management app (Owner, Manager/Warden, Student).
Node.js + Express + Prisma + PostgreSQL (Neon in production). One API serves web
and mobile: auth is JWT bearer tokens (access + refresh), not cookies.

JSON field names, role names (`owner` / `manager` / `student`), enum values and
error codes match `meraki-frontend/src/types/domain.ts` and
`src/services/interfaces.ts` exactly.

## What's in it

| Area | What it does |
| --- | --- |
| **Accounts** | Password login (email or phone), refresh-token rotation with reuse detection, sign out / sign out everywhere, change password, password reset by email, invitations that create real logins (residents, staff, co-owners), deactivated accounts refused on every request |
| **Properties, rooms, beds** | Portfolio with live stats, rooms with beds created per type, bed status, transactional assign / vacate / transfer |
| **Residents** | Admission (optional invitation + security deposit), profile with charges, payments, complaints, leave, visitors and documents; move-out blocked while dues are unpaid (owner can override) |
| **Billing** | Rent raised automatically on the 1st (first month pro-rated), due on the configured day (default 5th), flat late fee after a grace period (off by default), deposits and one-off charges, adjustments with a reason, manual payments, refunds, PDF receipts |
| **Online payments** | Razorpay Orders + Checkout; payment confirmed server-side with Razorpay (verify endpoint and signed webhook), idempotent, amount-checked; refunds through Razorpay |
| **Requests** | Complaints (photos, internal notes, assignment, status history), leave, visitors (requests, walk-ins, check-in/out), feedback (anonymous stays anonymous), emergency alerts |
| **Operations** | Staff, maintenance tickets, inventory with stock ledger (never negative), notices with audiences and read tracking, events |
| **Files** | Student documents and complaint photos in private storage (Cloudflare R2 or a local folder), presigned upload/download links, review workflow |
| **Owner** | Settings, plans with enforced limits, analytics (live month + monthly snapshots), global search |
| **Jobs** | Rent, late fees, due reminders, month-end snapshots, cleanup — in-process scheduler or `npm run job <name>` |

## Run it locally

```bash
cd backend
npm install
npx prisma generate          # npm 11 skips Prisma's install scripts; generate explicitly
cp .env.example .env          # fill in DATABASE_URL, DIRECT_URL, JWT secrets
npm run prisma:deploy         # apply the committed migrations
npm run db:seed               # demo organization with data for every screen
npm run dev                   # http://localhost:4000/health
```

Demo logins (password `meraki@123`): `owner@demo.com`, `manager@demo.com`,
`student@demo.com`. The seed refuses to run when `NODE_ENV=production`; for a
real deployment create the first owner with `npm run db:seed:prod` (see `.env.example`).

Database: either Neon (pooled URL in `DATABASE_URL`, direct URL in `DIRECT_URL`)
or a local Postgres (same URL in both). JWT secrets:
`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`,
two different values.

## Tests

The tests need a disposable PostgreSQL whose database name ends in `_test`
(they refuse anything else):

```bash
npm run test:db:up      # Docker: postgres:16 on 127.0.0.1:55432, migrations applied
npm test                # ~290 tests: authorization, tenancy, billing, every module
npm run test:db:down
```

On Windows without `sh`, start the container by hand (see `scripts/test-db.sh`)
and run `npx prisma migrate deploy` with `DATABASE_URL` pointing at it.
`TEST_DATABASE_URL` overrides the default URL.

## Configuration

Everything is in `.env.example`, with comments. Misconfiguration stops the
server at start-up instead of failing later; in production it refuses
placeholder JWT secrets, `CORS_ORIGINS=*`, simulated payments, console email
and local file storage.

| Setting | Values |
| --- | --- |
| `PAYMENT_MODE` | `disabled` (default) · `simulated` (development only) · `razorpay` |
| `MAIL_MODE` | `console` (development default) · `resend` · `disabled` (production default) |
| `STORAGE_MODE` | `local` (development default) · `r2` · `disabled` (production default) |
| `JOBS_ENABLED` | `true` to run the scheduler in this process; `false` when an external cron calls `npm run job` |

### Razorpay

1. Create test-mode API keys in the Razorpay dashboard and set `RAZORPAY_KEY_ID`
   and `RAZORPAY_KEY_SECRET`, with `PAYMENT_MODE=razorpay`.
2. Add a webhook to `https://<api>/api/v1/payments/webhook` with events
   `payment.captured`, `payment.failed`, `refund.processed`, `refund.failed`, and
   put its secret in `RAZORPAY_WEBHOOK_SECRET`.
3. Flow: `POST /payments/pay-now` creates an Order for the outstanding balance
   (the amount is decided by the server) → the app opens Razorpay Checkout →
   `POST /payments/verify` checks the Checkout signature and fetches the payment
   from Razorpay; the webhook confirms it too. Either path credits it once.
4. Live keys (`rzp_live_…`) are refused until `PAYMENTS_LIVE_ENABLED=true`.

Nothing counts as paid on the browser's word: only a payment Razorpay reports
as captured, for that order and the exact amount, is credited. A mismatch is
flagged for staff; paying a due that staff settled meanwhile is credited and
flagged for a refund decision.

### Email (Resend)

Set `MAIL_MODE=resend`, `RESEND_API_KEY` and a `MAIL_FROM` on a domain verified
in Resend, plus `APP_URL` (links in emails point to the web app). With email
disabled, password reset answers "not set up", and invitation links are still
returned to the admin who created them so they can be shared another way.

### Cloudflare R2 (file storage)

1. Cloudflare dashboard → R2 → create a bucket (e.g. `meraki-files`). Keep it
   **private**; don't enable the public `r2.dev` URL.
2. R2 → Manage API tokens → create a token with Object Read & Write on that
   bucket. Set `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID`,
   `R2_BUCKET` and `STORAGE_MODE=r2`.
3. Bucket → Settings → CORS policy: allow `PUT` and `GET` from your frontend
   origin(s) with the `Content-Type` header, e.g.

   ```json
   [{ "AllowedOrigins": ["https://your-app.example"], "AllowedMethods": ["PUT", "GET"], "AllowedHeaders": ["Content-Type"], "MaxAgeSeconds": 3600 }]
   ```

Uploads go straight from the browser to R2 with a presigned PUT that fixes the
file's type and size; the API then checks the stored object before accepting
it. Downloads are presigned GETs issued after an authorization check and expire
in `SIGNED_URL_TTL_SECONDS`. Object keys contain ids only, never names.

### Scheduled jobs

| Job | When (APP_TIMEZONE) | What |
| --- | --- | --- |
| `generate-rent` | daily 00:30 | Raises this month's rent for every active / on-notice resident who has none yet (idempotent) |
| `late-fees` | daily 01:00 | Adds the flat late fee to rent unpaid after the grace period, once per month |
| `due-reminders` | daily 09:00 | Reminds 2 days before the due date, and 3 and 10 days after |
| `monthly-snapshot` | 1st, 02:00 | Freezes last month's occupancy and collection for analytics |
| `cleanup` | daily 03:00 | Expired tokens and invitations, abandoned uploads |

Each run claims its time slot in the database first, so several API instances
never run the same job twice. On a host whose instances sleep (free tiers), set
`JOBS_ENABLED=false` and call e.g. `npm run job generate-rent` from the host's
cron (Render Cron Job, GitHub Actions schedule, …). Runs are recorded in `JobRun`.

## API

Base path `/api/v1`. Every response is `{ data, error, meta: { requestId } }`.
Errors carry `code` ∈ `VALIDATION · NOT_FOUND · FORBIDDEN · CONFLICT ·
UNAUTHENTICATED · EXPIRED · NOT_IMPLEMENTED · NOT_CONFIGURED` and, for
validation, `fieldErrors`.

```
Auth          POST /auth/login · /auth/refresh · /auth/logout · /auth/logout-all · /auth/change-password
              GET  /auth/session · PATCH /auth/profile
              POST /auth/forgot-password · /auth/reset-password
              GET  /auth/invitations/:token · POST /auth/invitations/accept
Invitations   GET/POST /invitations · POST /invitations/:id/resend · /invitations/:id/revoke
Properties    GET/POST /properties · GET/PATCH /properties/:id · PATCH /properties/:id/status
Rooms & beds  GET/POST /rooms · PATCH /rooms/:id · PATCH /beds/:bedId/status · POST /beds/assign · /beds/vacate
Students      GET/POST /students · GET /students/me · /students/next-code · PATCH /students/self
              GET/PATCH /students/:id · PATCH /students/:id/status
Charges       GET/POST /charges · POST /charges/generate · PATCH /charges/:id
Payments      GET /payments · /payments/summary · /payments/:id/receipt · /payments/:id/receipt.pdf
              POST /payments/record · /payments/reminders · /payments/pay-now · /payments/verify
              POST /payments/:id/refund · GET /refunds · POST /payments/webhook (Razorpay, raw body)
Complaints    GET/POST /complaints · GET/PATCH /complaints/:id · POST /complaints/:id/comments
Leave         GET/POST /leave · POST /leave/:id/decide · /leave/:id/cancel
Visitors      GET/POST /visitors · POST /visitors/walk-in · /visitors/:id/decide · /check-in · /check-out · /cancel
Maintenance   GET/POST /maintenance · PATCH /maintenance/:id
Inventory     GET/POST /inventory · GET /inventory/transactions · POST /inventory/adjust
Notices       GET/POST /announcements · PATCH /announcements/:id · POST /:id/publish · /:id/archive · /:id/read · /read-all
Events        GET/POST /events · PATCH /events/:id · PATCH /events/:id/status
Staff         GET/POST /staff · PATCH /staff/:id · PATCH /staff/:id/status
Feedback      GET/POST /feedback · GET /feedback/mine · /feedback/summary
Documents     GET /documents/mine · GET /documents?studentId= · POST /documents/:id/upload · /remove · /review · GET /documents/:id/file
Uploads       POST /uploads · GET /uploads/:id/url  (+ PUT/GET /uploads/local/:token in local mode)
Emergency     GET/POST /emergency · POST /emergency/:id/acknowledge · /emergency/:id/resolve
Settings      GET/PATCH /settings · GET/POST /settings/plan
Analytics     GET /analytics/owner-overview · /trends · /property-comparison · /manager-overview
Activity      GET /activity · GET /notifications · PATCH /notifications/:id · /notifications/read-all
Search        GET /search?q=
Health        GET /health (liveness) · GET /ready (database reachable)
```

## Code layout

```
src/
  config/        env (validated at start-up), prisma client
  middleware/    authenticate, validate (Zod), rate limits, errors, request id
  modules/<name> <name>.service.js (rules + authorization) · routes · controller · validation
                 operations modules export <name>.module.js and are mounted automatically
  services/      mail (console/Resend), storage (local/R2)
  jobs/          scheduler, job definitions, CLI
  utils/         scope (tenant checks), ledger (balances incl. refunds), sideEffects
                 (activity + notifications), counters, money/dates, tokens, password policy
prisma/          schema.prisma, migrations (CHECK constraints and partial indexes are
                 hand-written in the migration SQL), seed.js (demo), seed-prod.js (first owner)
```

Adding a module: Prisma model + migration → `*.service.js` (use `scope.js` for
every tenant check, `$transaction` for multi-step writes, guarded `updateMany`
for status changes) → routes → `<name>.module.js` exporting `{ path, routes }`
→ tests in `test/` → an HTTP adapter in the frontend.

## Security

Bcrypt passwords with a password policy · refresh tokens hashed, rotated, with
family revocation on reuse · token version invalidates access tokens on password
change / sign-out-everywhere · scope (role, organization, property, student) read
from the database on every request, never from the token or client · another
organization's records answer "not found" · composite foreign keys stop
cross-organization rows in the database itself · CHECK constraints for money,
stock and beds · row locks for payments and stock · Helmet, CORS allowlist, rate
limits · no stack traces in production · gateway webhooks verified and idempotent ·
private file storage with short-lived signed links.

## Deploying

Any Node 20+ host (Render, Railway, Fly). Root directory `backend`.

- Build: `npm ci --include=dev && npm run build` (generates the Prisma client and
  runs `prisma migrate deploy`)
- Start: `npm start`
- Health check: `GET /ready`
- Env: everything in `.env.example`, with `NODE_ENV=production`, real secrets,
  `CORS_ORIGINS` and `APP_URL` set to the deployed frontend.

## Not included yet

- Two-step sign-in (OTP): the setting is stored but not enforced.
- SMS notifications (Indian bulk SMS needs DLT registration first); email and
  in-app notifications work.
- Charging hostel owners for plans: limits are enforced, nothing is billed.
- GST tax invoices: receipts are payment receipts, not tax invoices.
