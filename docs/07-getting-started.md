# 07 — Getting Started (Local Setup)

How to run the real app on your machine. These steps are **verified** — they're
what actually works on this repo today, including the gotchas.

## Prerequisites

- **Node.js ≥ 20** and npm.
- A **PostgreSQL** database. The backend ships pointing at a Neon cloud DB; for
  safe local work use a dev database (see [06-decisions.md](06-decisions.md) → D-0003).
- Each app installs on its own — there is **no root `npm install`**.

> **Node not on PATH?** On this machine Node lives at `/opt/homebrew/bin`. If a
> terminal says `node: command not found`, run:
> ```bash
> export PATH="/opt/homebrew/bin:$PATH"
> ```

## Run the real app (backend + frontend)

Two terminals.

### 1. Backend API → http://localhost:4000

```bash
cd backend
npm install
cp .env.example .env     # fill DATABASE_URL, DIRECT_URL, JWT secrets
npm run prisma:generate  # generate the Prisma client
npm run prisma:migrate   # apply migrations (DB change — see conventions)
npm run db:seed          # demo owner/manager/student (dev DB only)
npm run dev              # starts with --watch on :4000
```

You should see: `StayPookie API on http://localhost:4000 (...) · payments: ...`

### 2. Frontend → http://localhost:5173

```bash
cd staypookie-frontend
npm install
cp .env.example .env     # VITE_API_BASE_URL=http://localhost:4000/api/v1
npm run dev              # Vite on :5173
```

Open **http://localhost:5173**.

## Demo logins (dev seed)

After `npm run db:seed`, sign in with:

| Role | Email | Password |
| --- | --- | --- |
| Owner | `owner@demo.com` | `meraki@123` |
| Manager | `manager@demo.com` | `meraki@123` |
| Student | `student@demo.com` | `meraki@123` |

> The password is still `meraki@123` on purpose — it's hashed into existing
> databases, so it was kept through the StayPookie rename (see D-0004).

## How the two talk to each other

- Frontend finds the API via **`VITE_API_BASE_URL`** (`staypookie-frontend/.env`).
- API allows the frontend origin via **`CORS_ORIGINS`** (`backend/.env`).
- The real frontend talks **only** to the API — no mock data. Modules without a
  backend show as *unavailable* (see [02-architecture.md](02-architecture.md)).

## ⚠️ The live-database gotcha

`backend/.env` currently has `NODE_ENV=production` and points at the **live Neon
database**. Running locally with these values **reads and writes real data**, and
the demo seed refuses to run in production. For day-to-day development, use a
separate dev database and `NODE_ENV=development`. Tracked in D-0003.

## Useful checks before you push

```bash
# frontend (from staypookie-frontend/)
npm run typecheck
npm run lint
npm run build

# backend (from backend/)
npm test
```

## The prototype (demo only)

`prototype/` is the original clickable demo with **mock data only**. Run it
separately (`cd prototype && npm install && npm run dev`) when you want to show
the full UI without a backend. Never point it at the real API.

_Last reviewed: 2026-11-08_
