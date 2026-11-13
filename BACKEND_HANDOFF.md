# Backend Handoff

A working reference for anyone integrating with the StayPookie API or picking up
backend work for the first time. For setup, environment variables, Razorpay/R2/
Resend configuration, scheduled jobs and deployment, see `backend/README.md` —
this document does not repeat that, it's the contract: what's callable, what it
returns, who's allowed to call it, and the rules for touching the database.

## Stack

Node.js + Express + Prisma + PostgreSQL (Neon in production). One API serves
web and mobile. Auth is JWT bearer tokens (access + refresh), not cookies.

Request/response field names, role names, enum values and error codes are
defined once and shared exactly between the backend and the frontend:

- `staypookie-frontend/src/types/domain.ts` — domain types and enums (`Role`,
  `StudentStatus`, `ComplaintStatus`, etc.)
- `staypookie-frontend/src/services/interfaces.ts` — the exact request/response
  shape of every service method (`IStudentService`, `IPaymentService`, …)

If you need the precise shape of a request body or a response, those two files
are the source of truth, not this document.

## Roles

Three roles: `owner`, `manager`, `student`. There is no separate "warden" or
"accountant" role at the account level — staff with those job titles still get
a `manager` login; `StaffMember.role` (`manager` · `warden` · `accountant` ·
`housekeeping` · `security` · `cook` · `maintenance`) is their job title, not
their account role. Only staff whose role is in `LOGIN_STAFF_ROLES`
(`manager`, `warden`, `accountant` — see `src/modules/invitations/invitation.service.js`)
are ever eligible for an app account or for being set as a property's
`managerStaffId`. If you're writing a check against "is this staff member
allowed to do X", check role membership in `LOGIN_STAFF_ROLES`, not just that
the staff row exists.

Scope, enforced server-side on every request from data in the database (never
from the request or the token):

- **owner** — everything in their organization, across all its properties.
- **manager** — their own property only. Another organization's or another
  property's record answers `404 NOT_FOUND`, not `403`, so scope leaks don't
  tell an attacker whether a record exists.
- **student** — their own record only.

## Auth flow

```
POST /auth/login             { role, identifier, password, remember } -> { session, user, accessToken, refreshToken }
POST /auth/refresh           rotates the refresh token; reuse of an already-rotated-away token revokes the whole family
POST /auth/logout            ends this session
POST /auth/logout-all        ends every session on the account
POST /auth/change-password   also ends every other session
POST /auth/forgot-password   POST /auth/reset-password
GET  /auth/invitations/:token   POST /auth/invitations/accept
GET  /auth/session            PATCH /auth/profile
```

`identifier` is an email or a 10-digit Indian mobile number; phone numbers are
compared normalized (digits only), so formatting never matters.

## Response envelope and error codes

Every response is `{ data, error, meta: { requestId } }`. On success `data` is
populated and `error` is `null`; on failure it's the reverse.

| Code | Meaning |
| --- | --- |
| `VALIDATION` | Bad input; `error.fieldErrors` maps field name → message |
| `NOT_FOUND` | Missing, or out of the caller's scope (see above) |
| `FORBIDDEN` | Exists, in scope, but this role can't do this |
| `CONFLICT` | State conflict (duplicate, race lost, business rule) |
| `UNAUTHENTICATED` | No/invalid/expired access token |
| `EXPIRED` | A link or token expired (invitation, reset link) |
| `NOT_IMPLEMENTED` | Module not wired up on this deployment |
| `NOT_CONFIGURED` | Feature exists but isn't set up (e.g. payments disabled) |

The frontend's HTTP client additionally reports `UNAVAILABLE` for network
failures or a 5xx with no body — that code is client-side only, never sent by
the API itself.

## Endpoints by module

Base path `/api/v1`.

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
Devices       GET/POST /devices · DELETE /devices/:pushToken   (mobile push; NOT_CONFIGURED when PUSH_MODE=disabled)
App           GET /app/config   (public: { minVersion, latestVersion, pushEnabled, onlinePayments })
Search        GET /search?q=
Health        GET /health (liveness) · GET /ready (database reachable)
```

`/devices` and `/app/config` are used only by the mobile app; their shapes are
in `mobile/src/contract/mobile.ts`. `POST /devices` takes
`{ pushToken: "ExponentPushToken[…]", platform: "ios" | "android", appVersion? }`
and is idempotent; a push carries `data: { notificationId, category, link }`,
where `link` is the same web path the in-app notification has.

For the exact request/response TypeScript shape behind any of these, look up
the matching service interface in `interfaces.ts` (e.g. `/students` ↔
`IStudentService`, `/payments/*` ↔ `IPaymentService`). Every HTTP adapter in
`staypookie-frontend/src/services/http/` implements one of these interfaces 1:1.

## Database safety

**Never run `prisma migrate dev` or `npm run db:seed` against the shared,
staging, or production database.** Both are development-only commands:

- `migrate dev` can drop and recreate tables to resolve drift. It is only ever
  safe against a disposable local database.
- `db:seed` creates demo data and is meant for a fresh local database. It
  refuses to run when `NODE_ENV=production`, but don't rely on that guard for
  a staging database that isn't `production` — check which database
  `DATABASE_URL` points at before running either command.

What to use instead:

| Situation | Command | Database |
| --- | --- | --- |
| Local development | `npm run prisma:deploy`, `npm run db:seed` | Local Postgres via `docker compose up -d db` (`docker-compose.yml`, port 5433, `staypookie_dev`) |
| Running the test suite | `npm run test:db:up` / `npm test` / `npm run test:db:down` | A disposable container the script creates itself (port 55432, `staypookie_test`); tests refuse to run against any database whose name doesn't end in `_test` |
| Staging/production deploy | `npm run build` (runs `prisma migrate deploy`) | Neon, via `DATABASE_URL`/`DIRECT_URL` — applies only the committed migrations, never resets anything |
| First production owner account | `npm run db:seed:prod` | Neon — the only seed script meant to touch it |

Before merging any PR that adds a Prisma migration, **back up the production
Neon database (create a branch in the Neon dashboard) first** — the next
deploy applies that migration automatically via `prisma migrate deploy`.

## Not included yet

- Two-step sign-in (OTP): the setting is stored but not enforced.
- SMS notifications (Indian bulk SMS needs DLT registration first); email,
  in-app and mobile push notifications work.
- Charging hostel owners for plans: limits are enforced, nothing is billed.
- GST tax invoices: receipts are payment receipts, not tax invoices.

## Where to look next

- `backend/README.md` — environment variables, running locally, Razorpay/R2/
  Resend setup, scheduled jobs, deploying.
- `staypookie-frontend/src/services/interfaces.ts` — exact request/response types.
- `staypookie-frontend/src/types/domain.ts` — shared enums and domain types.
- `backend/src/modules/<name>/` — one module per folder: `*.service.js` (rules
  and authorization), routes, controller, validation.
