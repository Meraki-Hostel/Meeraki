# Meraki Hostel Management — Frontend

A complete, frontend-only hostel-management app with three role experiences — **Owner**, **Manager/Warden** and **Student** — running entirely on a typed mock service layer with deterministic demo data. No backend is required.

> **Demo only.** Authentication, payments, messaging and uploads are simulated. Data lives in your browser's `localStorage` and is neither private nor secure. Role checks in the browser are a demonstration; a real backend must enforce authorization.

## Quick start

Requires Node.js 18+ (tested on Node 22).

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run typecheck` | Strict TypeScript check (no emit) |
| `npm run lint` | ESLint (bans `any`, `alert()`, `confirm()`) |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run preview` | Serve the production build locally |

**Deploying `dist/`:** this is a single-page app using browser history routing. Configure your host to serve `index.html` for unknown paths (Netlify `_redirects`: `/* /index.html 200`; Nginx: `try_files $uri /index.html;`). `vite preview` already does this.

The app works offline once installed: fonts are bundled locally and all imagery is inline SVG.

## Demo accounts

On `/login`, click any card under **Explore with a demo account**. Alternatively, sign in with email or phone plus the shared demo password **`meraki@123`**. Pick the matching role tab first, or you'll get a "registered as …" message.

| Persona | Role | Email | Scope |
| --- | --- | --- | --- |
| Pawan Kushwah | Owner | pawan@merakiliving.example | All 5 properties |
| Mr. Arif Khan | Owner (co-owner) | arif.khan@merakiliving.example | All 5 properties |
| Anita Desai | Manager | anita.desai@merakiliving.example | Crown Boys Residence |
| Kavita Rao | Manager | kavita.rao@merakiliving.example | HSD Loyal Girls Hostel (shows scoping) |
| Rahul Sharma | Student | rahul.sharma@student.example · 98765 43210 | Room 204, Bed B, Crown Boys |

Switch persona any time from the **account menu** (top right) without losing changes. **Log out** returns you to `/login`.

Other demo states:
- `/invite/accept?token=demo-invite-2026` shows a valid invitation.
- `/invite/accept?token=expired-invite` shows an expired one.
- `/reset-password?token=expired` shows an expired reset link.
- The Google button only shows a "Demo only" toast.

## Demo data, persistence and reset

- Seed data is generated deterministically by `src/data/fixtures/seed.ts` and fully linked: every bed↔student, payment↔charge and complaint↔room reference is consistent.
  - Volume: 5 Lucknow properties, 30 rooms, 71 beds, 53 students, 14 staff, 156 rent charges, 139 payments.
  - Activity: complaints, leave, visitors, maintenance, 47 inventory items, notices, events, feedback, documents, notifications and activity.
- **Demo clock:** "today" is fixed at **18 Oct 2026** (`src/lib/clock.ts`), so due/overdue states and upcoming lists stay stable whenever you open the demo. Time-of-day follows your real clock.
- All changes are saved under one versioned key, `meraki-demo-v1`, through `src/services/repository.ts`, the **only** module that touches demo storage. If stored data is unreadable or from another schema version, the seed is restored and a toast explains why.
- **Reset demo data** is in the account menu and on Owner → Settings. It sits behind a confirmation dialog, restores the seed, and keeps you signed in.
- Sidebar collapse is a device UI preference stored separately (`meraki-ui-v1`) and is not affected by reset.

## Route map

| Area | Routes |
| --- | --- |
| Public / auth | `/` (redirects), `/login`, `/forgot-password`, `/reset-password`, `/invite/accept`, `/unauthorized`, `/help` (also reachable signed out) |
| Owner | `/owner/dashboard`, `/owner/properties`, `/owner/properties/new`, `/owner/properties/:propertyId` (tabs via `?tab=rooms\|residents\|finance\|activity`), `/owner/analytics`, `/owner/finance`, `/owner/staff`, `/owner/complaints`, `/owner/events`, `/owner/inventory`, `/owner/plans`, `/owner/settings` |
| Manager | `/manager/dashboard`, `/manager/rooms`, `/manager/students`, `/manager/students/:studentId`, `/manager/payments`, `/manager/complaints`, `/manager/leave`, `/manager/visitors`, `/manager/maintenance`, `/manager/inventory`, `/manager/staff`, `/manager/announcements`, `/manager/events`, `/manager/feedback`, `/manager/activity` |
| Student | `/student/home`, `/student/profile`, `/student/rent`, `/student/complaints`, `/student/leave`, `/student/visitors`, `/student/notices`, `/student/documents`, `/student/feedback`, `/student/emergency` |
| Shared | `/notifications`, `/profile`, `/help`, `*` (designed 404) |

Every route loads directly and survives refresh. Signed-out visits go to `/login` and come back afterwards. Visiting another role's area goes to `/unauthorized`. Useful deep links: `?id=` on complaints, `?receipt=` on finance and payments, `?new=1` on announcements, maintenance and student complaints, and `?walkin=1` on visitors.

## A 10-minute demo script

1. **Student (Rahul):**
   - Raise a complaint and request leave.
   - Request a visitor for today.
   - On **Rent**, use *Pay now* (simulated; no credentials are ever asked) and open the receipt.
2. **Switch to Anita (Manager):**
   - Open the complaint, set *In progress*, assign Deepak and add a note.
   - Approve the leave.
   - Approve, then check in the visitor.
   - Record a payment for another resident.
   - Publish a notice targeted to *Floor 2*.
   - Create an event.
   - Add a student through the 4-step wizard (try a duplicate phone number), then **Transfer** them to another bed.
3. **Switch back to Rahul:**
   - The complaint timeline shows Anita's note.
   - The leave shows *Approved* and the visitor *Checked in*.
   - The Floor 2 notice and the event appear, and notifications have arrived.
4. **Switch to Pawan (Owner):**
   - The complaint is in the portfolio queue and the event is under Events.
   - Add a property; it appears on the dashboard.
   - Change Settings and refresh; the change persists.
   - Press **Ctrl/Cmd + K** to search.
   - Finally, **Reset demo data**.

## Architecture

```
src/
  app/            App root, router (lazy-loaded per role), providers (session, toast, confirm)
  components/
    ui/           Design system: Button, fields, Modal/Drawer, DataTable, Tabs, Dropdown, StatusBadge, states…
    layout/       AppShell, Sidebar, nav config, Topbar menus, GlobalSearch, PageHeader, guards
    domain/       ComplaintDrawer/Timeline, Receipt, RecordPayment, BedPicker/AssignBed, ActivityFeed
    brand/        BrandLogo, illustrated CampusScene and PropertyImage (offline SVG)
  features/       auth/, owner/, manager/, student/, shared/, common/ (role-aware boards)
  data/fixtures/  Catalog + deterministic seed builder
  services/       interfaces.ts (I*Service contracts), mock/*, repository.ts, errors.ts, index.ts (container)
  hooks/          useQuery (auto-refresh on data change), useMutation (pending/field errors/toasts), misc
  lib/            clock, format (₹, en-IN, Asia/Kolkata), validation, CSV export, PRNG
  types/          domain.ts — every entity and status enum
```

- Pages call `services.*` through `useQuery` / `useMutation`. They never import fixtures or touch storage.
- Every mock method reads the session and **scopes data by role**:
  - Owner: all properties.
  - Manager: only the assigned property.
  - Student: only their own records. Internal complaint notes are hidden from students.
- Mock methods validate inputs and throw a typed `ServiceError` (`VALIDATION` with field errors, `NOT_FOUND`, `FORBIDDEN`, `CONFLICT`, `UNAUTHENTICATED`, `EXPIRED`).
- Mutations append **activity log** entries and **notifications** for the affected roles. Every open screen refreshes automatically.
- **Backend integration:** implement the interfaces in `src/services/interfaces.ts` with HTTP adapters and swap them in `src/services/index.ts`. Contracts, permissions and state transitions are in [`BACKEND_HANDOFF.md`](./BACKEND_HANDOFF.md).

**Stack:** React 18, TypeScript (strict), Vite 6, React Router 6, Tailwind CSS 4, Lucide icons, Recharts. Fonts (Fraunces, Figtree) are self-hosted via Fontsource. No component framework.

## Verification performed

- `npm run typecheck`, `npm run lint` and `npm run build` pass with no errors or warnings.
- **Route smoke test** with headless Chromium against the production build: 78 checks covering every route above, per role plus signed out, via direct navigation (equivalent to refresh). Each renders its page with **0 console or page errors**, and cross-role access redirects to `/unauthorized`.
- **End-to-end workflow test** of 35 UI-driven steps: the demo script above, plus login validation, the role-mismatch message, the negative-stock block, duplicate-phone detection, occupied beds being unselectable, settings persisting after refresh, and reset.
- **Responsive scan** of every route at 360, 768, 1024 and 1440 px: no horizontal page overflow. Wide tables scroll inside their own container.
- **Keyboard checks:**
  - Visible focus on all controls.
  - Modals trap focus, close on Escape and return focus to the opener.
  - Menus and tabs use arrow keys.
  - Ctrl+K search works by keyboard.
  - One `h1` per page.

Reproducible browser checks live in [`qa/`](./qa/README.md).

## Known limitations

- **Mocked behaviour:**
  - Authentication: there is one shared demo password, and the reset and invite password steps don't change anything. "Remember me" and session timeout are visual only.
  - Payments and receipts: pay-now always succeeds, and receipts download as plain text. Printing uses the browser print dialog.
  - Messages: reminders, invitations, support requests and emergency alerts only create in-app notifications or toasts. No SMS or email is sent, and the emergency page tells students to call 112.
  - Uploads: only the file name and size are stored; file contents never leave the browser.
- **Data scope:**
  - Rent charges exist for Aug–Oct 2026. There is no automatic monthly charge generation; new students get a charge for the current month on admission.
  - Analytics months before August come from archived monthly snapshots in the seed. Live months are computed from charges and payments.
- **Owner scope:** owners view residents read-only. Admissions, transfers and payment recording are Manager tasks, matching the spec's role split.
- **Multi-tab:** two open tabs don't sync live; the last write wins and a refresh shows the latest state.
- **Not covered by the automated checks:** colour contrast was chosen against WCAG AA but not machine-audited, screen-reader behaviour wasn't tested with real assistive technology, and browsers other than Chromium weren't tested.
