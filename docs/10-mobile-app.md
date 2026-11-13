# 10 — Mobile App

> **Status: built, not yet released.** `mobile/` has every screen below for all
> three roles, and the backend work (B1–B4) is done with tests. Still ahead:
> running it on real phones, push credentials, and the store release (M5).
> Items marked **[review]** still need a decision. Update this doc in the same
> PR as the code that changes it.

One Android + iOS app for **all three roles**, built on the existing API.
It covers what people do on a phone; heavy setup stays on the web.

## Contents

1. [Stack](#stack)
2. [Where it lives](#where-it-lives)
3. [Scope per role](#scope-per-role)
4. [How it talks to the API](#how-it-talks-to-the-api)
5. [Backend work needed](#backend-work-needed)
6. [Screens and navigation](#screens-and-navigation)
7. [Milestones](#milestones)
8. [Testing and verifying](#testing-and-verifying)
9. [Release](#release)
10. [Open decisions](#open-decisions)

---

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | **React Native + Expo** (managed workflow, dev builds) | Same language and mental model as the web app; one codebase for both stores. |
| Language | TypeScript, `strict` | Same as `staypookie-frontend/`. |
| Routing | Expo Router (file-based) | Route groups map cleanly onto roles. |
| Server data | TanStack Query | Caching, retries, pull-to-refresh, offline-friendly reads. |
| Forms | Plain state + `useAction` | The API's `fieldErrors` are shown under each field; no form library needed. |
| Secure storage | `expo-secure-store` | Refresh token lives in Keychain / Keystore, never AsyncStorage. |
| Payments | `react-native-razorpay` | Native Razorpay Checkout. Native module → needs a **dev build**, not Expo Go. |
| Media | `expo-image-picker`, `expo-file-system`, `expo-sharing` | Complaint photos, document upload, receipt PDFs. |
| Push | `expo-notifications` + Expo Push Service | One API for FCM and APNs. |
| Builds / updates | EAS Build, EAS Submit, EAS Update | Store builds and over-the-air JS fixes. |
| Crash reporting | Not added yet **[review]** | Phones fail silently otherwise; Sentry is the likely choice. |

## Where it lives

A **fourth independent app** in the monorepo, same rules as the other three
(see [02-architecture.md](02-architecture.md)):

```
mobile/
├── src/
│   ├── app/             Expo Router routes; paths mirror the web: /student/*, /manager/*, /owner/*
│   │   ├── _layout.tsx  providers, update gate, role guards (Stack.Protected), push-tap routing
│   │   ├── login.tsx · notifications.tsx · account/password.tsx
│   │   └── student/ manager/ owner/   each: _layout (Stack) + (tabs)/ + detail screens
│   ├── contract/        domain.ts + interfaces.ts GENERATED from staypookie-frontend; mobile.ts hand-written
│   ├── api/             client (envelope, errors, single-flight refresh), services, files, tokens
│   ├── auth/            session: cold start, sign-in, sign-out
│   ├── push/            permission + Expo push token + POST /devices
│   ├── features/        screens shared by roles (Me, complaint detail/queue, update gate)
│   ├── components/      ui kit, theme (web palette), tabs, date field, approve/reject
│   └── lib/             format (₹, Asia/Kolkata), links, labels, razorpay, version
├── scripts/sync-contract.mjs
├── app.config.ts        name / bundle id / plugins / EAS project id from env
├── eas.json
├── .env.example
├── CLAUDE.md
└── README.md
```

Routes use real path segments (`/student/rent`), not route groups, so the web
paths stored in notification links map onto app screens almost one-to-one.

- Own `package.json`; no root install. Never imports from
  `staypookie-frontend/`, `prototype/` or `backend/`.
- Env vars use Expo's `EXPO_PUBLIC_` prefix, starting with
  `EXPO_PUBLIC_API_BASE_URL`. No Razorpay key is needed in the app — the key
  id comes back from `pay-now`. Add each new var to `mobile/.env.example`.

## Scope per role

**Rule:** if a task is done standing in a corridor, it's in the app. If it
needs a long form, KYC or a big table, it stays on the web and the app opens
the web page in the browser.

### Student — everything the web has

| Screen | API |
| --- | --- |
| Home (bed, dues, notices, quick actions) | `analytics`, `payments/charges`, `announcements` |
| Rent & receipts — **pay now**, receipt PDF | `payments/*` |
| Notices | `announcements` |
| Complaints — raise with camera photos, track | `complaints`, `uploads` |
| Leave — apply, track | `leave` |
| Visitors — pre-register, track | `visitors` |
| Profile — edit contact / emergency details | `auth/profile`, `students` |
| Documents — view, upload | `documents`, `uploads` |
| Feedback | `feedback` |
| Emergency — one-tap alert | `emergency` |

### Manager / Warden — daily operations

| In the app | Stays on web (v1) |
| --- | --- |
| Dashboard | Student admission wizard |
| Approve / reject leave and visitors; log walk-in visitor | Create / edit rooms and beds |
| Complaints — assign, update status, add note | Bulk charge generation |
| Emergency alerts — acknowledge, resolve | Staff create / edit |
| Record cash / UPI payment; send reminders | Activity log |
| Maintenance tickets — update status, cost | |
| Inventory — stock in / out | |
| Students & rooms — **read-only** lookup | |
| Announcements — post | |

### Owner — overview on the go

| In the app | Stays on web (v1) |
| --- | --- |
| Dashboard across properties | Create / edit properties |
| Analytics (occupancy, collections, arrears) | **Payout accounts** (Razorpay Route KYC) |
| Finance — collections, payments, refunds (view) | Plans / subscription |
| Complaints across properties | Org settings |
| Staff directory, events (view) | |

## How it talks to the API

Same API, same contract as the web app — no mobile-only endpoints except the
ones under [Backend work needed](#backend-work-needed).

### Contract sharing

`staypookie-frontend/src/types/domain.ts` and `src/services/interfaces.ts` are
the contract ([BACKEND_HANDOFF.md](../BACKEND_HANDOFF.md)). There is no shared
package, so:

- `npm run sync:contract` copies both files into `mobile/src/contract/` with a
  "generated — do not edit" header.
- `npm run check:contract` fails if the copies differ from the source. It runs
  in mobile's verify step, so a contract change that forgets mobile is caught.
- Where the web contract uses browser types, mobile defines its own input type
  next to it. Known case: `ComplaintInput.attachments: File[]` → mobile uses
  `{ uri, name, mimeType, size }[]` and uploads each file first.

### Envelope and errors

Every response is `{ data, error, meta }`. The client unwraps `data` or throws
a typed error carrying `code`, `message`, `fieldErrors`.

| Code | App behaviour |
| --- | --- |
| `VALIDATION` | Show `fieldErrors` under the matching inputs. |
| `UNAUTHENTICATED` | Try one refresh; if that fails, sign out to login. |
| `FORBIDDEN` / `NOT_FOUND` | Inline message; never a blank screen. |
| `CONFLICT` | Show the server message (e.g. bed already taken). |
| `EXPIRED` | Show as expired (links, invitations) — not as an error toast. |
| `NOT_IMPLEMENTED` / `NOT_CONFIGURED` | Show the feature as **unavailable**. Never as success. |
| Network failure | "You're offline" banner; keep cached data visible. |

### Auth and sessions

- `POST /auth/login` with `{ role, identifier, password }` — identifier is an
  email or 10-digit Indian mobile number. Returns access + refresh tokens.
- Access token (15 min default) is kept **in memory only**.
- Refresh token (30 days default) is kept in `expo-secure-store`.
- On cold start: read the refresh token → `POST /auth/refresh` →
  `GET /auth/session` → route to the role's tabs.
- **One refresh in flight at a time.** Concurrent 401s wait on the same
  promise. Refresh tokens rotate; reusing an old one outside the 15-second
  grace window revokes the whole family and logs the user out everywhere.
- Logout: `POST /auth/logout`, unregister the push token, wipe secure storage
  and the query cache.
- Forgot password / invitation acceptance: open the **web** pages in the
  browser for v1 (the emails already link there).

### Online rent payment

Server-authoritative, same as web — the app never decides a payment is paid.

1. `POST /payments/pay-now` `{ chargeId, method }`. Two possible responses:
   - `{ pending: true, order, keyId }` (`PAYMENT_MODE=razorpay`) → continue below.
   - The recorded payment itself (simulated mode, dev/demo — no money moved)
     → go straight to the receipt. The app must handle both shapes.
2. Open `react-native-razorpay` Checkout with that order.
3. On success → `POST /payments/verify` `{ orderId, paymentId, signature }`.
4. Show the result: `paid` → receipt; `processing` → "confirming, we'll notify
   you"; `failed` → retry. The webhook also confirms, so `processing` resolves
   on its own.
5. User closing Checkout is a cancel, not a failure. Refetch the charge either way.

### Uploads

1. `POST /uploads` `{ purpose, fileName, contentType, sizeBytes }` → upload id +
   presigned URL.
2. `PUT` the file bytes straight to that URL (R2 in prod, local stand-in in dev).
3. Pass the upload id(s) to the complaint / document request.
4. To view: `GET /uploads/:id/url` → short-lived download URL.

Compress photos client-side before upload (long edge ~1600 px) — mobile data
is the common case.

### Receipts

`GET /payments/:paymentId/receipt.pdf` with the bearer header → save with
`expo-file-system` → open the share sheet (`expo-sharing`).

### Notification links

`Notification.link` holds **web paths** (e.g. `/student/rent`). `src/lib/links.ts`
maps each web path to an app route; unknown paths open the notifications list.
Keep this map next to `nav.ts` changes on the web side.

## Backend work (done)

| # | Change | Why | Approval |
| --- | --- | --- | --- |
| B1 | **Push devices**: `Device` model (`userId`, `pushToken` unique, `platform`, `appVersion`, `lastSeenAt`); `GET/POST /devices`, `DELETE /devices/:pushToken`; sign-out-everywhere removes them. Migration `20261113120000_mobile_devices` | Notifications are DB rows only today; nothing reaches a phone. | **Schema migration — needs approval before running on Neon.** |
| B2 | **Push send** as an outbox over `Notification` (`pushedAt`): `modules/devices/push.dispatch.js` claims committed rows (`FOR UPDATE SKIP LOCKED`), sends via Expo Push, drops `DeviceNotRegistered` tokens, releases rows if the request fails. Runs ~1.5 s after a notification, plus a 15 s sweep; `npm run job push` for sleeping hosts | Must not send inside the transaction — a rollback would leave a push for nothing. | — |
| B3 | `GET /app/config` (public) → `{ minVersion, latestVersion, pushEnabled, onlinePayments }` from `MOBILE_MIN_VERSION` / `MOBILE_LATEST_VERSION` | Force an update after a breaking contract change. | — |
| B4 | `PUSH_MODE` (`disabled` / `console` / `expo`, console refused in production) + optional `EXPO_ACCESS_TOKEN`; push disabled → `POST /devices` answers `NOT_CONFIGURED` | Repo rule on integrations. | — |

Tests: `backend/test/devices.test.js` and `config.test.js`. They land in the same
PR as the mobile code that uses them.

**Not needed:** CORS (requests without an `Origin` header are already
allowed), new auth endpoints, payment endpoint changes.

## Screens and navigation

Bottom tabs per role; everything else is a stack screen from a tab.

| Role | Tabs |
| --- | --- |
| Student | Home · Rent · Requests (complaints / leave / visitors) · Notices · Me (profile, documents, feedback, emergency) |
| Manager | Today (dashboard + pending approvals) · Requests · Payments · Operations (maintenance, inventory, announcements) · Me |
| Owner | Dashboard · Finance · Complaints · Properties (read-only) · Me |

- Emergency is reachable in **one tap** from student Home, not buried in Me.
- Tab badges: unread notices (student), pending leave + open complaints and overdue dues (manager).
- Pull-to-refresh on every list; empty and error states on every screen.
- ₹ and dates formatted for `en-IN`, business day in `Asia/Kolkata`.
- Accessibility: dynamic font size respected, 44 pt tap targets, labels on
  icon-only buttons.

## Milestones

| # | Milestone | Done when | Status |
| --- | --- | --- | --- |
| **M0** | Foundation | `mobile/` scaffolded with CLAUDE.md + README; contract sync/check; API client with envelope, errors and refresh; login/logout; role tabs; notifications list; dev builds run on a real Android and iOS device. | Code done; needs a dev build on real devices |
| **M1** | Student | Every student screen above works against the dev API, including Razorpay test payment, photo complaint and receipt PDF. | Code done; needs Razorpay test-mode run on a phone |
| **M2** | Push | B1–B2 merged with tests; app asks permission after login (not on first launch), registers the token, deep-links on tap. | Backend done and tested; app side needs FCM/APNs credentials |
| **M3** | Manager | Manager scope above, with approvals usable one-handed. | Code done |
| **M4** | Owner | Owner scope above. | Code done |
| **M5** | Release | B3; icons, splash, store listings; TestFlight + Play internal track; pilot hostel using it for two weeks. | B3 done; store work not started |

M1 ships to the pilot as an internal build before M3/M4 start — students are
the largest user group and the simplest flows.

## Testing and verifying

```bash
cd mobile
npm run verify     # check:contract + typecheck + lint + test
```

- Unit tests (Jest + React Native Testing Library) for the API client,
  refresh logic, error mapping and link mapping.
- Before each milestone is called done: click through the role's screens on a
  real Android phone and an iPhone against a local backend with the dev seed
  (`owner@demo.com` / `manager@demo.com` / `student@demo.com`).
- Point the app at a local backend by LAN IP
  (`EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:4000/api/v1`) — `localhost`
  on a phone is the phone.
- Never point a dev build at the production database.

## Release

| Item | Notes |
| --- | --- |
| Accounts | Apple Developer ($99/yr), Google Play Console ($25 once). **[review]** whose name. |
| Identity | App name, bundle id / package name (e.g. `com.staypookie.app`) **[review]**. |
| Build profiles | `development` (dev client), `preview` (internal testers), `production` (stores) in `eas.json`. |
| Store forms | Privacy policy URL, Play data-safety form, iOS privacy labels — the app collects names, phone numbers, photos, payment status. |
| Payments review | Rent is a real-world service, so Razorpay is allowed; Apple in-app purchase does not apply. |
| OTA updates | EAS Update for JS-only fixes; anything touching native modules or permissions needs a store build. |
| Versioning | `version` in `app.config.ts`; bump `minVersion` (B3) only for breaking API changes. |

## Open decisions

- **[review]** Store accounts owner and app name / bundle id.
- **[review]** Approval to run migration `20261113120000_mobile_devices` on Neon (adds `Device`, `Notification.pushedAt`).
- **[review]** Sentry or no crash reporting for v1.
- **[review]** Phone-number login with OTP — not built in the API today; v1
  uses the existing password login.
- **Branching:** built on `feature/mobile-app` from `main`; `feature/owner-payouts` also edits `schema.prisma`, so whichever merges second rebases (migrations don't conflict: they have different timestamps).

See also: [D-0006](06-decisions.md) for why Expo and why all roles.

_Last reviewed: 2026-11-13_
