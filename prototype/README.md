# StayPookie — Hostel Management Prototype

A frontend-only, high-fidelity prototype for validating the product scope with students, wardens/managers and owners. There is **no backend**: all data is seeded mock data held in React state and persisted to `localStorage`.

> Kept for product demos and scope validation. The production app is in [`../staypookie-frontend`](../staypookie-frontend) and [`../backend`](../backend).

**Demo only, fully isolated.** Every person, hostel, payment and message here is fictional. The prototype never calls the StayPookie API, never sends anything, and never touches a real database. The real app shares no code with it.

```bash
cd prototype
npm install
npm run dev               # http://localhost:5174 (the real app uses 5173, so both can run at once)
npm run build && npm run check:isolation   # proves zero network requests
```

`check:isolation` checks the source (no network APIs, no imports from the real app or backend), the built files (no API paths), and opens every route in Chromium, failing on any fetch/XHR/WebSocket/event-stream request or any request to another origin. The only third-party request it allows is the Google Fonts stylesheet in `index.html` (typography, never data). It reuses an installed Chromium (or `CHROMIUM_PATH`) and never downloads one.

## Demo guide

- **Switch roles** from the profile menu (top right): Student · Manager / Warden · Owner. The same menu lets you pick the student persona, the manager's property, and **reset demo data**.
- Default personas: **Rahul Sharma** (Room 204-B, Shanti Residency), **Anita Desai** (manager, Shanti Residency), **Pawan Kushwah** (owner, 5 properties).
- The demo calendar is fixed to **25 September 2026** so that due dates and "today" lists always read correctly.
- Manager/Owner: press **⌘K / Ctrl+K** for global search.

## Structure

| Path | What |
| --- | --- |
| `src/data/seed.ts` | Deterministic, relational mock data (5 properties, 1,250 beds, ~1,080 students, dues, complaints, …) |
| `src/store/AppStore.tsx` | Single client store: every prototype action (add student, assign/transfer bed, payments, complaints, leave, …) |
| `src/store/selectors.ts` | Derived values (payment status, occupancy, KPIs) — computed, never stored, so every screen stays consistent |
| `src/components/ui` | Design system: buttons, badges, cards, modals, drawers, toasts, confirm dialogs, tabs, tables |
| `src/components/domain` | Workflow components: Add Student wizard, bed picker, payment & receipt, complaint card/drawer |
| `src/pages/{student,manager,owner}` | Role experiences |
