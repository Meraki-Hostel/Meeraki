# 03 — Roadmap & Module Status

**Every module now has a real backend.** The module-by-module build-out (M2/M3
below) that this doc originally tracked is done — PR #35 landed all of it in
one go, ahead of the original one-at-a-time plan. What's left before launch is
deploy + verify, not building — see [09-launch-checklist.md](09-launch-checklist.md).

_Source of truth for status: `staypookie-frontend/src/services/index.ts` and
`staypookie-frontend/src/lib/features.ts` (`AVAILABLE` lists every module)._

## ✅ Live (API-backed, end to end — nothing shows "unavailable" in the real app)

| Module | Notes |
| --- | --- |
| Auth | Login, roles, refresh tokens, invitations, password reset. |
| Properties | Owner's properties. |
| Rooms / Beds | Transactional bed assignment. |
| Students | Student records, bed assignment, biodata. |
| Payments | Razorpay Checkout + webhook; refunds; receipts. Paid state confirmed only server-side. |
| Complaints | Student↔manager ticket + comment thread. |
| Leave | Request → approve/reject, date and duration rules. |
| Visitors | Request + walk-in log, visiting-hours rules. |
| Maintenance | Tickets with cost tracking. |
| Inventory | Items + transactions. |
| Announcements / Notices | Owner→residents broadcast. |
| Events | Hostel events with capacity. |
| Staff | Non-student workers, roles/shifts. |
| Feedback | Resident feedback + rating. |
| Documents | Student document records + uploads. |
| Settings | Org settings, plans. |
| Search | Cross-entity search. |
| Emergency | Emergency alerts. |
| Uploads | File storage (local dev / Cloudflare R2). |
| Notifications, Activity, Analytics | Cross-cutting — feed, audit trail, dashboards. |

## The recipe for a *new* module (when one comes up)

From `backend/CLAUDE.md` — copy Auth or Payments as the worked example:

1. Add the Prisma model(s).
2. `*.validation.js` (Zod input validation).
3. `*.service.js` (logic + `scope.js` tenant checks + `$transaction` for multi-step writes).
4. `*.controller.js`.
5. `*.module.js` exporting `{ path, routes }` — auto-discovered by `src/routes/modules.js`, no manual mount needed.
6. Add an `http` adapter in the frontend and flip that service from `unavailable` to `http` in `services/index.ts`, then add it to `AVAILABLE` in `lib/features.ts`.

A module is **not done** until step 6 and it's been clicked through in the real app.

## Planned features (beyond the module build-out)

These are product bets on top of the core modules above. They're committed in
direction; the details are a draft to refine. Order is roughly as listed, and
**#4 is explicitly last.**

### PF-1 — Postpaid services (grace period for rent)

- **What:** When a student can't pay rent within the first **5 days** of the
  month, a manager can activate **postpaid** for that student — they keep their
  stay while the pending amount is tracked as outstanding.
- **Why:** Real hostels extend informal credit today; this makes it trackable
  instead of lost in a notebook.
- **Where it hooks in:** the money model — `RentCharge` (the outstanding bill) and
  `Payment` / `PaymentStatus`. Likely needs a postpaid flag/state on the student
  or charge, a manager action to grant it, and visibility of "who is on postpaid
  and how much is pending". See [08-data-model.md](08-data-model.md).
- **Open questions [review]:** auto-eligible after day 5 or always manager-granted?
  Any limit on amount / duration? Does it affect online pay-now?

### PF-2 — One-page printable student biodata

- **What:** Auto-generate a clean, one-page, print-ready **biodata** for each
  student from their registration details, so managers can keep a physical copy
  in each student's file.
- **Why:** Offline record-keeping and quick reference without opening the app.
- **Where it hooks in:** `StudentProfile` (the registration data already exists).
  Add a print/PDF view of a single student. Mostly frontend; a print stylesheet or
  a server-side PDF if we want consistent output.
- **Open questions [review]:** exact fields to include, and photo? PDF download vs
  browser print?

### PF-3 — Automated daily data backup to Google Drive

- **What:** A reliable daily backup of essential student/customer data to **Google
  Drive**, organized into spreadsheets and folders, so managers can still reach
  their records if the app is down.
- **Why:** Data safety and business continuity — the records survive an app outage.
- **Where it hooks in:** a scheduled backend job that reads from PostgreSQL and
  writes to Google Drive (service-account auth). Independent of the UI.
- **Open questions [review]:** which tables are "essential"? one sheet per hostel?
  retention (keep N days)? who owns the Drive folder? Handle it as its own
  decision in [06-decisions.md](06-decisions.md) — it touches credentials and data
  export.

### PF-4 — Template-based hostel landing page system _(build last)_

- **What:** After the core is done, a built-in landing-page builder. Managers on an
  **eligible plan** pick from professionally designed templates and publish their
  hostel's page at a unique URL like `staypookie.com/hostel/<hostel-name>`.
- **Why:** Gives each hostel an online presence without a separate website — a
  paid upsell.
- **Where it hooks in:** ties to **plans/billing** (there's already a Plans page in
  the frontend), public (unauthenticated) page rendering, a template system, and
  slug/URL routing. A sizeable sub-project of its own.
- **Open questions [review]:** which plan tier unlocks it? custom domains later?
  how editable are templates (text only vs layout)?

_Last reviewed: 2026-11-08_
