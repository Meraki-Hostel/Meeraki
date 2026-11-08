# 06 — Decision Log

Short record of choices we've made and why — so we don't re-argue settled
questions, and so a new person understands the "why" behind the code.

Format: one entry per decision. Newest on top. Keep each to a few lines.

---

### D-0005 — Launch date and scope

- **Status:** Decided.
- **Context:** Public go-live **11 Nov 2026, 1:00 PM IST**; team cutoff **10 Nov
  2026, 11:59 PM IST**.
- **Update (8 Nov, after PR #35):** the scope question is moot — all 22 backend
  modules landed in one PR, not the one-at-a-time plan this decision originally
  assumed. Nothing is cut for launch; the open work is deploying and verifying
  the full product (see [09-launch-checklist.md](09-launch-checklist.md)), not
  building any of it.
- **Still to confirm [Pawan]:** whether online payments go live (real Razorpay,
  needs KYC + a public webhook URL) or launch with offline recording only.

---

### D-0004 — Product renamed from Meraki to StayPookie

- **Status:** Decided (PR #39).
- **Why:** Rebrand to StayPookie across the whole codebase and docs.
- **Consequence:** Case-preserving rename everywhere; frontend folder is now
  `staypookie-frontend/`; packages are `staypookie-*`. Two things kept on purpose:
  the demo password `meraki@123` (hashed in the existing DB — renaming breaks
  logins) and a comment in an already-applied Prisma migration (checksum integrity).

---

### D-0003 — Local dev should not use the live database _(OPEN — to decide)_

- **Status:** Open question, not yet decided.
- **Context:** `backend/.env` has `NODE_ENV=production` and points at the live
  Neon database, so running locally reads/writes real data.
- **Options:** (a) a separate Neon branch/db for dev; (b) local PostgreSQL via
  `backend/scripts/test-db.sh`; (c) accept it and be careful.
- **Recommendation:** (a) a dedicated Neon dev branch — closest to production,
  zero local setup, and Neon branching is cheap/instant. Set `NODE_ENV=development`
  locally so the dev seed and simulated payments are available.
- **Decision:** _pending Pawan._

---

### D-0002 — The real frontend is API-only; no mock fallback

- **Status:** Decided (reflected in `services/index.ts`).
- **Why:** A hybrid app that silently falls back to mock data hides broken
  integrations and lies to users. Unbuilt modules show "unavailable" instead.
- **Consequence:** Mock data lives only in `prototype/`. Building a module means
  wiring it to the API, end to end.

---

### D-0001 — Three separate apps in one repo

- **Status:** Decided (see root README).
- **Why:** The clickable prototype is useful for demos but must not be confused
  with the real product. Separate folders, separate deploys, no shared install.
- **Consequence:** Keep `prototype/`, `staypookie-frontend/`, and `backend/` strictly
  apart. See [02-architecture.md](02-architecture.md).

---

_Template for a new entry:_

```
### D-00XX — <short title>
- **Status:** Decided / Open
- **Context:** why this came up
- **Decision:** what we chose
- **Consequence:** what it means going forward
```

_Last reviewed: 2026-11-08_
