# 02 — Architecture & Boundaries

One monorepo, **three independently deployable apps**. They must not blur into
each other — that separation is the single most important rule in this project.

```
Meeraki_Prototype/
├── prototype/        Clickable demo. Mock data ONLY. For showing people.
├── staypookie-frontend/  The REAL web app. Talks ONLY to the API. No mock data.
└── backend/          The REAL API. Node + Express + Prisma + PostgreSQL (Neon).
```

## The three apps

| App | Stack | Data source | Purpose |
| --- | --- | --- | --- |
| `prototype/` | React + Vite | Mock data, in-memory | Demos & design reference. Everything "works" but nothing is real. |
| `staypookie-frontend/` | React + Vite + TypeScript | **The API only** | The product users will actually use. |
| `backend/` | Node + Express + Prisma | PostgreSQL (Neon) | REST API for web + future mobile. |

## How a request flows (the real app)

```
Browser → staypookie-frontend (React)
            → services/ (interface)  ← this is the seam
              → http/ adapter  → fetch → backend API (Express)
                                          → service + Prisma → PostgreSQL (Neon)
```

- The frontend calls **`services`** (see `staypookie-frontend/src/services/index.ts`).
- Each service is either a real **`http`** adapter, or marked **`unavailable`**
  when its backend module doesn't exist yet — currently every module is wired,
  so nothing hits this path, but it's the rule for the next module that ships
  UI before its backend. There is **no mock fallback** in the real app — a
  module is either wired to the API or it honestly says "unavailable".

## The hard rules (why things don't get messed up)

1. **`prototype/` is mock-only. `staypookie-frontend/` is API-only.** Never add mock
   data to the real frontend, and never point the prototype at the real API.
2. **No hybrid, no fake success.** If a backend module isn't built, the real app
   shows it as *unavailable* — it must not pretend an action worked.
3. **The frontend never decides permissions.** Role / property / student scope is
   enforced on the server from the auth token, never trusted from the client.
4. **Database changes need approval.** Schema/migration/seed changes to the real
   (Neon) database are not made casually — get a yes first.
5. **`.env` files are never committed.** Each app ships `.env.example`.

## Local URLs

| Service | URL |
| --- | --- |
| Frontend (real app) | http://localhost:5173 |
| Backend API | http://localhost:4000/api/v1 |
| Prototype | its own Vite port (run separately) |

The frontend finds the API via `VITE_API_BASE_URL` in `staypookie-frontend/.env`.
The API allows the frontend origin via `CORS_ORIGINS` in `backend/.env`.

> ⚠️ **Heads-up:** `backend/.env` currently uses `NODE_ENV=production` and points
> at the **live Neon database**. Running the app locally reads/writes real cloud
> data. For safe local experimenting, consider a separate dev database. _(decision to confirm — see 06-decisions.md)_

_Last reviewed: 2026-11-07_
