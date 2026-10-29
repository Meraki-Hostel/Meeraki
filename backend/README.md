# Meraki API — backend for the Meraki frontend

Node.js + Express + Prisma + PostgreSQL (Neon). Built to match your frontend's
service contract exactly: the API's JSON field names, role names (`owner` /
`manager` / `student`), error codes and payment/receipt behavior line up 1:1
with `src/types/domain.ts` and `src/services/interfaces.ts`.

One API serves **web and mobile** — auth uses JWT bearer tokens (access +
refresh), not cookies, so both clients send `Authorization: Bearer <token>`.

## What's implemented (and why these first)

Your two priorities — **authentication** and **payments** — are built in full,
plus the spine they depend on:

| Module | Interface | Status |
| --- | --- | --- |
| Auth | `IAuthService` | ✅ full: personas, password login, login-as, refresh, logout, session, forgot/reset, invitations, profile |
| Payments | `IPaymentService` | ✅ full: charges, payments, summary, record, receipt, reminders, **payNow** (simulated + real Razorpay) |
| Properties | `IPropertyService` | ✅ list (+stats), get, create, update, setStatus |
| Rooms/Beds | `IRoomService` | ✅ list, create, update, setBedStatus, **assignBed / vacateBed** (transactional) |
| Students | `IStudentService` | ✅ list, get, me, create, update, setStatus, updateSelf, nextStudentCode |
| Complaints | `IComplaintService` | ✅ list, get, create (resident), update/triage + assign (staff), comments with staff-only internal notes |
| Notifications/Activity | `INotification/IActivityService` | ✅ read + mark-read (created by payment and complaint flows) |
| Leave, visitors, maintenance, inventory, announcements, events, feedback, documents, analytics, settings, search | their interfaces | ⬜ not yet — each follows the identical recipe (see below). The frontend hides these and shows "Not available yet". |

## The error contract (this is the clever part)

The frontend's `ServiceError` has codes `VALIDATION · NOT_FOUND · FORBIDDEN ·
CONFLICT · UNAUTHENTICATED · EXPIRED`. The API returns **exactly those codes**:

```json
{ "data": null, "error": { "code": "VALIDATION", "message": "...", "fieldErrors": { "amount": "..." } } }
```

So the HTTP adapter maps them with zero translation, and your pages catch
errors just like they did with the mock.

## Setup

```bash
cd backend
npm install
cp .env.example .env     # then fill in the values below
```

1. **Database**: either Neon (neon.tech; copy the **pooled** URL into
   `DATABASE_URL` and the **direct** URL into `DIRECT_URL`), or a local Postgres
   (`createdb meraki_dev`, then put
   `postgresql://<you>@localhost:5432/meraki_dev` in both).
2. **JWT secrets**: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` — put two different values in `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.
3. **Migrate + seed** (migrations are committed in `prisma/migrations/`):
   ```bash
   npm run prisma:migrate     # applies migrations; after editing schema.prisma add `-- --name <change>`
   npm run db:seed
   ```
4. **Run**: `npm run dev` → http://localhost:4000/health

Seed creates three demo logins (password `meraki@123`, matching your frontend's
`DEMO_PASSWORD`): `owner@demo.com`, `manager@demo.com`, `student@demo.com`,
with a property, rooms, beds, a resident and two rent dues ready to pay.

## Payments

Controlled by `PAYMENT_MODE`:

- **`simulated`** (default) — `payNow` posts a completed payment immediately,
  generates a receipt number (`RCPT-YYYY-NNNN`), and fires the same activity +
  notifications the mock did. This is the working demo flow; nothing else needed.
- **`razorpay`** — real online payments, the secure way:
  1. `POST /payments/pay-now` creates a Razorpay **Order** (amount is decided
     server-side from the outstanding balance — the client can't tamper with it)
     and returns `{ pending, order, keyId }`.
  2. The frontend opens Razorpay Checkout with that order.
  3. Razorpay calls `POST /api/v1/payments/webhook`; the server **verifies the
     signature**, then finalizes the `Payment` (idempotent on the order id).
  Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
  Manual (`recordPayment`) and cash flows are unchanged.

We never trust a client-reported success or amount — paid state comes only from
the verified webhook.

## Endpoint map (→ interface method)

```
POST   /api/v1/auth/login                    auth.loginWithPassword
POST   /api/v1/auth/login-as                 auth.loginAsPersona
POST   /api/v1/auth/refresh                  (token refresh)
GET    /api/v1/auth/session                  auth.getSession
GET    /api/v1/auth/personas                 auth.listPersonas
POST   /api/v1/auth/forgot-password          auth.requestPasswordReset
PATCH  /api/v1/auth/profile                  auth.updateProfile
GET    /api/v1/properties                    properties.list
POST   /api/v1/properties                    properties.create
GET    /api/v1/rooms                          rooms.list
POST   /api/v1/beds/assign                    rooms.assignBed
POST   /api/v1/beds/vacate                    rooms.vacateBed
GET    /api/v1/students                       students.list
GET    /api/v1/students/me                    students.me
GET    /api/v1/charges                         payments.listCharges
GET    /api/v1/payments                        payments.listPayments
GET    /api/v1/payments/summary                payments.summary
POST   /api/v1/payments/record                 payments.recordPayment
POST   /api/v1/payments/pay-now                payments.payNow
GET    /api/v1/payments/:id/receipt            payments.getReceipt
POST   /api/v1/payments/reminders              payments.sendReminders
```
(Full list in the route files.)

## Frontend integration

The HTTP adapters live in `../meraki-frontend/src/services/http/` and are
switched on by `VITE_API_BASE_URL` (see the frontend README). Auth, properties,
rooms/beds, students, payments, notifications and activity use this API.

## Deploying

Any Node host works (Render, Railway, Fly). Point it at the `backend/` folder:

- **Build**: `npm ci --include=dev && npm run build` (generates the Prisma
  client and runs `prisma migrate deploy`)
- **Start**: `npm start`
- **Env vars**: everything in `.env.example`. Set `NODE_ENV=production`, real
  secrets, and `CORS_ORIGINS` to the deployed frontend URL(s), comma-separated.
- **Health check**: `GET /health`

Run `npm run db:seed` once against a new database only if you want the demo
accounts there.

## Adding the remaining modules (the recipe)

For each (e.g. leave): add the Prisma model(s) → `*.validation.js` (Zod) →
`*.service.js` (logic + `scope.js` tenant checks + `$transaction` for multi-step
writes + `utils/effects.js` for activity, notifications and counters) →
`*.controller.js` → `*.routes.js` → mount in `routes/index.js` → add an HTTP
adapter, swap it in for the `unavailable(...)` stand-in in `services/index.ts`
and add the module to `AVAILABLE` in `lib/features.ts`. Complaints is the
smallest complete example to copy; auth and payments are the larger ones.

## Security already wired in

Bcrypt password hashing · refresh tokens stored hashed + rotated + revocable ·
role/property/student scope enforced server-side from the token (never from the
client) · Prisma parameterized queries · Helmet · CORS allowlist · rate limiting
· central error handler (no stack traces in prod) · transactional bed assignment
and payment posting · gateway webhooks verified and idempotent.
