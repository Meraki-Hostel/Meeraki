# Meraki — Hostel Management Prototype

A frontend-only, high-fidelity prototype for validating the product scope with students, wardens/managers and owners. There is **no backend**: all data is seeded mock data held in React state and persisted to `localStorage`.

```bash
npm install
npm run dev        # http://localhost:5173
```

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
