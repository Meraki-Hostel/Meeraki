# 02 — Architecture & Boundaries

One monorepo, **three independently deployable apps**, kept strictly separate.

```
Meeraki_Prototype/
├── prototype/            Clickable demo. Mock data only. For showing people.
├── staypookie-frontend/  The REAL web app. Talks only to the API. No mock data.
├── backend/              The REAL API. Node + Express + Prisma + PostgreSQL (Neon).
└── mobile/               Expo app (Android + iOS) for all roles. API only — see 10-mobile-app.md.
```

| App | Stack | Data source | Purpose |
| --- | --- | --- | --- |
| `prototype/` | React + Vite | Mock, in-memory | Demos & design reference — nothing real. |
| `staypookie-frontend/` | React + Vite + TS | API only | What users actually use. |
| `backend/` | Node + Express + Prisma | PostgreSQL (Neon) | REST API for web + mobile. |
| `mobile/` | Expo + React Native + TS | API only | Android + iOS app — [10-mobile-app.md](10-mobile-app.md). |

## Request flow (real app)

```
Browser → staypookie-frontend → services/ (interface, the seam) → http/ adapter
        → backend API (Express) → service + Prisma → PostgreSQL (Neon)
```

Each frontend service is a real `http` adapter, or `unavailable` if its
backend doesn't exist yet (currently nothing — every module is wired). No
mock fallback in the real app, ever — see the rules in
[04-conventions.md](04-conventions.md).

## Local URLs

| Service | URL |
| --- | --- |
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:4000/api/v1 |
| Prototype | its own Vite port, run separately |

Frontend finds the API via `VITE_API_BASE_URL`; API allows the frontend
origin via `CORS_ORIGINS`.

> ⚠️ `backend/.env` currently has `NODE_ENV=production`, pointing at the
> **live Neon database** — running locally reads/writes real data. See D-0003
> in [06-decisions.md](06-decisions.md).

_Last reviewed: 2026-11-13_
