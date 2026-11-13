# backend — StayPookie API

Node 20+ (ESM, plain JavaScript) + Express 4 + Prisma 5 + PostgreSQL (Neon in prod). Serves both web and mobile with JWT bearer auth. See the repo-root `CLAUDE.md` for monorepo rules.

## Commands

```bash
npm run dev              # node --watch, http://localhost:4000 (GET /health)
npm run prisma:migrate   # prisma migrate dev; after schema edits: -- --name <change>
npm run db:seed          # local demo org/users/property/rooms/dues (password meraki@123); refuses NODE_ENV=production
npm run db:seed:prod     # first organization + owner only, from ORG_NAME/OWNER_* env; refuses if users exist
npm run job <name>       # run one scheduled job once, for an external cron (see "Scheduled jobs" below)
npm run build            # prisma generate + migrate deploy (used by deploy hosts)
npm start
```

Needs `.env` (copy `.env.example`): `DATABASE_URL`, `DIRECT_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS`, `PAYMENT_MODE`. Also used: `APP_URL` (links in invitation/reset emails), `PUBLIC_API_URL` (local-storage upload links), `MAIL_MODE`/`MAIL_FROM`/`RESEND_API_KEY`, `PUSH_MODE`/`EXPO_ACCESS_TOKEN`, `MOBILE_MIN_VERSION`/`MOBILE_LATEST_VERSION`, `STORAGE_MODE`/`STORAGE_LOCAL_DIR`/`R2_*`/`UPLOAD_MAX_MB`/`SIGNED_URL_TTL_SECONDS`, `JOBS_ENABLED`. `src/config/env.js` throws on missing required vars and refuses unsafe combinations in production (see its `configProblems()`) — add new vars there and to `.env.example`.

Tests (`node --test` + supertest, 22 files / 340+ tests) run against a disposable local Postgres, never `backend/.env`:

```bash
npm run test:db:up       # starts container staypookie-test-pg on 127.0.0.1:55432 and applies migrations (needs Docker)
npm test                 # known defects show as TODO and do not fail the run
npm run test:strict      # known defects fail the run
npm run test:db:down     # removes the container and its data
```

`test/helpers/env.js` refuses any `DATABASE_URL`/`TEST_DATABASE_URL` that is not `localhost`/`127.0.0.1` and does not end in `_test` — without Docker, point `TEST_DATABASE_URL` at any local Postgres database named like that (`createdb staypookie_test`, then `DATABASE_URL=... npm run prisma:deploy` once) and run `node --test` directly. A defect test is written with `defect("DEF-xx", ...)` from `test/helpers/defect.js`; when its fix lands, change it to a plain `test(...)`.

## Structure

```
src/app.js               express setup: helmet, CORS allowlist, json, rate limit, routes at /api/v1
src/routes/index.js      mounts the core modules; src/routes/modules.js auto-mounts the rest
src/modules/<name>/      <name>.routes.js · .validation.js (Zod) · .controller.js · .service.js
src/middleware/          authenticate (sets req.auth), validate(schema, source), errorHandler, rateLimit
src/services/            mail.js (console/Resend), storage.js (local/Cloudflare R2), push.js (console/Expo)
src/jobs/                scheduled jobs (see below) + cli.js for running one by hand
src/utils/               ApiError, respond.ok, asyncHandler, scope, money, ledger, tokens, counters, sideEffects
prisma/schema.prisma     models + enums; migrations/ committed
```

24 modules are mounted: devices (mobile push) and app (public `/app/config` for the mobile app), auth, invitations, properties, rooms (+ beds), students, payments (+ charges, refunds), settings, analytics, uploads, misc (activity, notifications), and — all wired, none mocked — complaints, leave, visitors, maintenance, inventory, announcements, events, staff, feedback, documents, search, emergency.

## Module recipe (follow auth/payments as examples)

1. Prisma model(s) in `schema.prisma` → `npm run prisma:migrate -- --name <change>`; commit the migration.
2. `*.validation.js`: Zod schemas; routes use `validate(schema)` or `validate(schema, "query")`.
3. `*.service.js`: all logic; first arg is `auth` (`{ userId, role, orgId, propertyId, studentId }`). Use `$transaction` for multi-step writes; lock the row you're serialising against (`lockCharge`-style `SELECT ... FOR UPDATE`) rather than trusting a read-then-write.
4. `*.controller.js`: thin — `asyncHandler(async (req, res) => ok(res, await svc.x(req.auth, ...)))`.
5. `*.module.js` exporting `{ path, routes }` from a `*.routes.js` (`r.use(authenticate)`, then routes) — `src/routes/modules.js` auto-discovers any `src/modules/<name>/<name>.module.js` and mounts it, so a new module needs no edit to `routes/index.js`. (The handful of core modules wired manually in `routes/index.js` — auth, invitations, properties, rooms, students, payments, settings, analytics, uploads, misc — predate this convention or need a non-standard sub-path.)
6. Add the matching adapter in `staypookie-frontend/src/services/http/`, flip it in `services/index.ts`, and add the module to `AVAILABLE` in `src/lib/features.ts`.

## Contract rules (frontend depends on these)

- Field names and enum values must match `staypookie-frontend/src/types/domain.ts`; Prisma enum member names are the literal strings.
- Return via `ok(res, data, status)` → `{ data, error: null, meta }`. Dates go out as ISO strings (`iso()` in `utils/money.js` for date-only).
- Throw helpers from `utils/ApiError.js` (`invalid(fieldErrors)`, `notFound`, `forbidden`, `conflict`, `unauthenticated`, `expired`, `notConfigured`) — never raw `res.status().json()`.

## Security rules

- Scope comes only from `req.auth`, which `authenticate` loads from the database (never from body/query/headers). In every service method use `requireRole`, `await assertPropertyAccess(auth, propertyId)` and `await propertyScope(auth, requested)` from `utils/scope.js` (both are async).
- Owner = every property of their **organization** and nothing else; manager = their property; student = their own records. Another organization's record is reported as 404, not 403.
- New org-owned rows (property, user, staff, invitation, activity) must get the right `orgId`. The composite keys `(propertyId, orgId) → Property(id, orgId)` make the database reject a cross-organization link.
- Payments: amounts are computed server-side; paid state comes only from either `/payments/verify` (Checkout signature verified, then fetched from Razorpay's API) or the signature-verified, idempotent webhook (`POST /payments/webhook`, needs the exact raw body) — never from the client's word alone.
- Routers mounted at `/` (rooms, payments, misc) authenticate only their own path prefixes (`r.use(["/rooms", "/beds"], authenticate)`); a bare `r.use(authenticate)` there would also catch every unknown URL and public route.
- The access token carries only `sub` and `role`; `authenticate` reads role, property and student from the database on every request.

## Payments

- `PAYMENT_MODE`: `disabled` (default; pay-now answers `NOT_CONFIGURED`), `simulated` (local dev only, rows have status `simulated`, production refuses to boot), `razorpay` (needs all three keys; `rzp_live_` keys also need `PAYMENTS_LIVE_ENABLED=true`).
- Only `captured` and `simulated` payments count toward balances, lists, summaries and receipts (`counted` in `utils/money.js`); refunds in `pending`/`processed` count against a payment's refunded total (`countedRefund` in `utils/ledger.js`) — a `failed` refund does not, so a refund whose real gateway outcome is still unknown (a timed-out create call) must stay `pending`, never `failed`, or the same amount can be refunded twice for real.
- Razorpay Checkout **is** wired into the frontend (`staypookie-frontend/src/lib/razorpay.ts`, used from the student rent page): the student pays via Checkout, the browser calls `/payments/verify`, and the webhook is the authoritative confirmation either way.
- Webhook: `POST /api/v1/payments/webhook`, registered in `app.js` before `express.json()` so the signature is checked on the raw bytes. Amount and currency must match the order or it stays pending and staff are notified. Refund webhooks match by `gatewayRefundId`, falling back to the `refundNo` sent as a note (for a refund whose creation call never got a response).
- Writes against one charge lock its row (`lockCharge`), so concurrent payments, and concurrent webhook deliveries, cannot overpay or double-settle.
- **Owner payouts (Razorpay Route).** Online rent is split at the gateway to the hostel's payout account, so it settles in the owner's bank account and never sits with the platform. `PayoutAccount` belongs to the organization; `Property.payoutAccountId` points a hostel at one (one account for all hostels, or one each; composite key `(payoutAccountId, orgId)` blocks cross-organization links). `payNow` uses only an `active` account and otherwise answers `NOT_CONFIGURED`: there is no fallback to the platform's own account, and an order that comes back without the transfer is refused. Onboarding (`modules/payouts`, mounted at `/payout-accounts`, owner only) is four Razorpay calls (linked account → stakeholder for individuals/proprietors → Route product → bank settlement), saved step by step so a failure leaves a resumable `draft`. The full account number and PAN are sent to Razorpay and never stored (only `bankLast4`). Webhooks: `product.route.*` moves the account's `kycStatus`; `transfer.processed` / `transfer.failed` set `Payment.transferStatus`. Refunds of a split payment send `reverse_all`. `RAZORPAY_ROUTE_CATEGORY/SUBCATEGORY` (default `housing`/`rentals`) are unconfirmed against the live API: check them in Razorpay test mode. In `simulated` mode an account is activated immediately with no gateway call.

## Email, storage and scheduled jobs

- Mail (`MAIL_MODE`): `console` (dev, logs instead of sending), `resend` (needs `RESEND_API_KEY` + verified domain), `disabled` (prod default; email-dependent features say so, and an invitation link is still shown to the admin who sent it).
- Files (`STORAGE_MODE`): `local` (dev only, under `STORAGE_LOCAL_DIR`), `r2` (Cloudflare R2, presigned upload/download URLs, see `README.md`), `disabled` (prod default; uploads say "not set up").
- Push (`PUSH_MODE`): `console` (dev, kept in `pushOutbox` and logged), `expo` (Expo Push Service), `disabled` (prod default; `POST /devices` answers `NOT_CONFIGURED`). Push is an **outbox over `Notification`**: never send a push from inside a transaction. `utils/sideEffects.js` only calls `kickPush()`; `modules/devices/push.dispatch.js` claims committed rows with `pushedAt IS NULL` (`FOR UPDATE SKIP LOCKED`, so instances never double-send), sends, drops `DeviceNotRegistered` tokens, and releases the rows if the whole request fails. It runs ~1.5 s after a kick and on a 15 s sweep in the API process; `npm run job push` does one pass for hosts that sleep. Rows older than an hour are never pushed. Raw SQL times are bound as naive UTC text cast to `timestamp` — a bound JS Date or `now()` is shifted by the session time zone.
- `JOBS_ENABLED=true` runs scheduled jobs inline in this process (rent generation on the 1st, late fees, due reminders at -2/+3/+10 days, monthly analytics snapshots, abandoned-upload cleanup). Set it `false` on a host that sleeps idle instances and run `npm run job <name>` from an external cron instead.

## Integrity rules that live only in SQL

Prisma cannot express these, so they are in migrations, not `schema.prisma` — if `prisma migrate dev` ever proposes dropping one, do not accept that:

- Referential/state: `Bed_occupied_iff_student`, `StudentProfile_moved_out_has_no_bed`, `Payment_one_pending_per_charge` (partial unique index — backs the "can't double-start pay-now" guard; see `payment.service.js`).
- Non-negative/positive amounts: `Payment_amount_positive`, `Refund_amount_positive`, `RentCharge_amount_nonnegative`, `InventoryItem_amounts_nonnegative`, `InventoryTransaction_quantity_positive`, `MaintenanceTicket_costs_nonnegative`, `Upload_size_positive`, `HostelEvent_capacity_nonnegative`.
- Shape: `LeaveRequest_dates_ordered`, `Feedback_rating_range`, `Announcement_audience_type`, `InventoryTransaction_type`, `Upload_purpose`, `Device_platform`.

## Deploy

Root directory `backend`. Build: `npm ci --include=dev && npm run build` (Prisma CLI is a devDependency). Start: `npm start`. Set `NODE_ENV=production`, real secrets, and `CORS_ORIGINS` to the deployed frontend origin(s). Before the first deploy that applies a new migration against the real database, back it up (or branch it, on Neon) — see the repo-root rule on database changes.
