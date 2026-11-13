# 07 — Getting Started (Local Setup)

Verified steps for running the real app, including gotchas.

## Prerequisites

- **Node.js ≥ 20** and npm.
- A **PostgreSQL** database — the backend ships pointing at a live Neon DB; see the gotcha below before you run anything.
- Each app installs on its own — no root `npm install`.

> Node not on PATH? `export PATH="/opt/homebrew/bin:$PATH"`.

## Run it (two terminals)

### 1. Backend → http://localhost:4000

```bash
cd backend
npm install
cp .env.example .env     # fill DATABASE_URL, DIRECT_URL, JWT secrets
npm run prisma:generate
npm run prisma:migrate   # DB change — needs approval, see 04-conventions.md
npm run db:seed          # demo owner/manager/student, dev DB only
npm run dev              # --watch on :4000
```

### 2. Frontend → http://localhost:5173

```bash
cd staypookie-frontend
npm install
cp .env.example .env     # VITE_API_BASE_URL=http://localhost:4000/api/v1
npm run dev
```

### 3. Mobile app (optional)

```bash
cd mobile && npm install && cp .env.example .env
# .env: EXPO_PUBLIC_API_BASE_URL=http://<your LAN IP>:4000/api/v1  (not localhost)
npm start
```

Expo Go works for most screens; Razorpay and push need a dev build
(`npm run android`). Details in [`mobile/README.md`](../mobile/README.md).

## Demo logins (after `npm run db:seed`)

| Role | Email | Password |
| --- | --- | --- |
| Owner | `owner@demo.com` | `meraki@123` |
| Manager | `manager@demo.com` | `meraki@123` |
| Student | `student@demo.com` | `meraki@123` |

(Password kept as `meraki@123` on purpose — it's hashed into existing DBs; see D-0004.)

## ⚠️ Live-database gotcha

`backend/.env` has `NODE_ENV=production` and points at the **live Neon
database** — running locally **reads and writes real data**, and the demo
seed refuses to run in production. Use a separate dev database and
`NODE_ENV=development` for day-to-day work. Tracked in D-0003.

## Before you push

```bash
# frontend
npm run typecheck && npm run lint && npm run build
# backend
npm test
# mobile
npm run verify
```

## Prototype (demo only)

`prototype/` is mock-data-only. `cd prototype && npm install && npm run dev` —
never point it at the real API.

_Last reviewed: 2026-11-13_
