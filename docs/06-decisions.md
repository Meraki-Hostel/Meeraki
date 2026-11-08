# 06 — Decision Log

One entry per decision, newest first, a few lines each — so we don't
re-argue settled questions.

---

### D-0005 — Launch date and scope

- **Status:** Decided. Public go-live **11 Nov 2026, 1 PM IST**; team cutoff **10 Nov, 11:59 PM IST**.
- **Update (8 Nov, PR #35):** the scope question is moot — all 22 modules landed in one PR. Nothing is cut for launch; remaining work is deploy + verify ([09-launch-checklist.md](09-launch-checklist.md)), not building.
- **Still to confirm [Pawan]:** real Razorpay (needs KYC + public webhook) or offline-recording only.

---

### D-0004 — Renamed Meraki → StayPookie

- **Status:** Decided (PR #39).
- **Consequence:** case-preserving rename everywhere; frontend folder is `staypookie-frontend/`. Kept on purpose: demo password `meraki@123` (hashed in the existing DB — renaming breaks logins) and one comment in an already-applied Prisma migration (checksum integrity).

---

### D-0003 — Local dev shouldn't use the live database _(OPEN)_

- **Context:** `backend/.env` has `NODE_ENV=production`, pointing at the live Neon DB — running locally reads/writes real data.
- **Options:** (a) separate Neon dev branch, (b) local Postgres via `backend/scripts/test-db.sh`, (c) accept it and be careful.
- **Recommendation:** (a) — closest to prod, zero local setup, Neon branching is cheap/instant.
- **Decision:** pending Pawan.

---

### D-0002 — Real frontend is API-only, no mock fallback

- **Status:** Decided (`services/index.ts`).
- **Why:** a silent mock fallback hides broken integrations and lies to users. Unbuilt modules show "unavailable" instead.

---

### D-0001 — Three separate apps, one repo

- **Status:** Decided.
- **Why:** the clickable prototype must never be confused with the real product. Separate folders, separate deploys, no shared install. See [02-architecture.md](02-architecture.md).

---

_New entry template:_

```
### D-00XX — <title>
- **Status:** Decided / Open
- **Context:** why this came up
- **Decision:** what we chose
- **Consequence:** what it means going forward
```

_Last reviewed: 2026-11-08_
