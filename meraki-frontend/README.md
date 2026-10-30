# Meraki Hostel Management — Frontend

A hostel-management app with three role experiences — **Owner**, **Manager/Warden** and **Student** — built on a typed service layer (`src/services/interfaces.ts`) that talks to the real API in [`../backend`](../backend). It has no demo or offline mode: the clickable mock-data prototype is the separate [`../prototype`](../prototype) app.

## Quick start

Requires Node.js 18+ (tested on Node 22).

```bash
cd meraki-frontend
npm install
cp .env.example .env   # points at the local API (required)
npm run dev            # http://localhost:5173
```

### Talking to the API

- **`VITE_API_BASE_URL` is required.** `npm run build` fails without it, and a dev server started without it shows a "not configured" screen. There is no fallback to demo data.
- Auth, properties, rooms/beds, students, payments, notifications and activity go through `src/services/http/*`. Dashboards are composed from those endpoints.
- If the server can't be reached, screens show an error with a retry, never cached or invented data.
- Modules without a backend yet (complaints, leave, visitors, maintenance, inventory, staff, notices, events, feedback, documents, analytics trends, settings, plans, search, emergency alerts) are hidden from the menu, show **Not available yet** at their URL, and their services reject with `NOT_IMPLEMENTED` (`src/lib/features.ts`, `src/services/unavailable.ts`).
- Local logins come from the backend's dev seed (`npm run db:seed` in `backend/`): `owner@demo.com` / `manager@demo.com` / `student@demo.com`, password `meraki@123`. They exist only in a dev database.

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run typecheck` | Strict TypeScript check (no emit) |
| `npm run lint` | ESLint (bans `any`, `alert()`, `confirm()`) |
| `npm run build` | Typecheck + production build to `dist/` (needs `VITE_API_BASE_URL`) |
| `npm run check:bundle` | After a build: proves `dist/` has no mock code, demo accounts or demo-auth endpoints |
| `npm run preview` | Serve the production build locally |

**Deploying `dist/`:** this is a single-page app using browser history routing. Configure your host to serve `index.html` for unknown paths (Netlify `_redirects`: `/* /index.html 200`; Nginx: `try_files $uri /index.html;`). `vite preview` already does this.

Fonts are bundled locally and all imagery is inline SVG, so no third-party assets are loaded. All data comes from the API.

## Accounts

There are no demo accounts in the real app. Accounts live in the backend database:

- **Local development:** `npm run db:seed` in `backend/` creates a demo organization with `owner@demo.com` / `manager@demo.com` / `student@demo.com` (password `meraki@123`) in your dev database only. The seed refuses to run in production.
- **A real deployment:** `npm run db:seed:prod` in `backend/` creates the first organization and its owner from environment variables.

Pick the matching role tab before signing in, or you'll get a "registered as …" message. Password reset and invitations are not available yet (they need email/SMS delivery); ask the hostel office.

## Route map

| Area | Routes |
| --- | --- |
| Public / auth | `/` (redirects), `/login`, `/forgot-password`, `/reset-password`, `/invite/accept`, `/unauthorized`, `/help` (also reachable signed out) |
| Owner | `/owner/dashboard`, `/owner/properties`, `/owner/properties/new`, `/owner/properties/:propertyId` (tabs via `?tab=rooms\|residents\|finance\|activity`), `/owner/analytics`, `/owner/finance`, `/owner/staff`, `/owner/complaints`, `/owner/events`, `/owner/inventory`, `/owner/plans`, `/owner/settings` |
| Manager | `/manager/dashboard`, `/manager/rooms`, `/manager/students`, `/manager/students/:studentId`, `/manager/payments`, `/manager/complaints`, `/manager/leave`, `/manager/visitors`, `/manager/maintenance`, `/manager/inventory`, `/manager/staff`, `/manager/announcements`, `/manager/events`, `/manager/feedback`, `/manager/activity` |
| Student | `/student/home`, `/student/profile`, `/student/rent`, `/student/complaints`, `/student/leave`, `/student/visitors`, `/student/notices`, `/student/documents`, `/student/feedback`, `/student/emergency` |
| Shared | `/notifications`, `/profile`, `/help`, `*` (designed 404) |

Routes for modules without a backend (owner analytics, staff, complaints, events, inventory, plans, settings; the manager's complaints, leave, visitors, maintenance, inventory, staff, notices, events, feedback; the student's complaints, leave, visitors, notices, documents, feedback, emergency) are hidden from the menu and show **Not available yet**.

Every route loads directly and survives refresh. Signed-out visits go to `/login` and come back afterwards. Visiting another role's area goes to `/unauthorized`.

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
  services/       interfaces.ts (I*Service contracts), http/* (API adapters), unavailable.ts, errors.ts, index.ts (container)
  hooks/          useQuery (auto-refresh on data change), useMutation (pending/field errors/toasts), misc
  lib/            clock (real date, Asia/Kolkata), features (modules with a backend), format, validation, CSV export
  types/          domain.ts — every entity and status enum
```

- Pages call `services.*` through `useQuery` / `useMutation`. Services are either API adapters or `unavailable(...)` stand-ins that reject with `NOT_IMPLEMENTED`; nothing returns made-up data.
- Permissions are enforced by the API: owners see only their organization, managers only their property, students only their own records. The UI's role guards are for navigation only.
- The API validates inputs and returns typed errors (`VALIDATION` with field errors, `NOT_FOUND`, `FORBIDDEN`, `CONFLICT`, `UNAUTHENTICATED`, `EXPIRED`, `NOT_IMPLEMENTED`, `NOT_CONFIGURED`); network failures become `UNAVAILABLE`. Screens show these, never a fake success.
- After every successful write, open screens refresh automatically.
- **Adding a module:** build it in `backend/`, add an adapter in `src/services/http/`, swap it in `src/services/index.ts`, and list it in `src/lib/features.ts`.

The previous in-browser mock (demo personas, fixtures, `meraki-demo-v1` storage) was removed. It is preserved in git tag `archive/frontend-mock`; the clickable demo for product evaluation is the separate [`../prototype`](../prototype) app.

**Stack:** React 18, TypeScript (strict), Vite 6, React Router 6, Tailwind CSS 4, Lucide icons, Recharts. Fonts (Fraunces, Figtree) are self-hosted via Fontsource. No component framework.

## Verification

- `npm run typecheck`, `npm run lint`, `npm run build` and `npm run check:bundle` pass. The bundle check proves the mock layer is gone and that no demo accounts, seed data or demo-auth endpoints are in `dist/`.
- Browser click-through against the real API (throwaway database): every route for every role loads with no page errors and no failed API calls; unavailable modules show "Not available yet"; no horizontal overflow at 360 px; with the API down, screens say the server can't be reached.
- The backend has its own test suite (`backend/test`), including role and tenant isolation.
- `qa/*.py` are the old mock-mode browser checks; they run only against the `archive/frontend-mock` tag.

## Known limitations

- Online rent payment: Razorpay Checkout is not wired in yet. Students pay at the office and staff record it; a receipt follows.
- No email or SMS delivery: password reset, invitations and reminders by message are not available. Reminders appear in the app only.
- Many modules have no backend yet and are hidden (see the route map).
- Rent dues are not generated automatically each month yet.
- **Not covered by automated checks:** colour contrast was chosen against WCAG AA but not machine-audited, screen readers weren't tested, and only Chromium was tested.
