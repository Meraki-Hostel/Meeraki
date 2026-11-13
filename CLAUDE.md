# StayPookie — monorepo

Hostel-management product (Owner, Manager/Warden, Student). Four independent apps; each has its own `package.json`, `CLAUDE.md` and README. There is no root install or workspace tooling — always `cd` into the app first.

| Folder | Role | Stack |
| --- | --- | --- |
| `staypookie-frontend/` | The real web app | React 18 + Vite 6 + TS (strict) + Tailwind 4 |
| `backend/` | REST API for web and mobile | Node 20+ ESM + Express + Prisma 5 + PostgreSQL |
| `mobile/` | Android + iOS app, all three roles | Expo SDK 58 + React Native + TS (strict) + Expo Router |
| `prototype/` | Original clickable prototype, kept for demos only | React 19 + Vite, mock data |

## Rules

- **Never commit, merge or push without explicit permission.** Make changes, verify, then show the diff summary and ask.
- **No AI/assistant attribution anywhere** — not in commit messages, PR descriptions, PR/code comments, or docs. No "Co-Authored-By: Claude" or similar, no mention of Claude/AI having written something. Write commit messages, PR descriptions and comments the way the person asking for the change would write them. The human who asked for the change is accountable for it, same as any other commit in this repo — it should read like one.
- `prototype/` is frozen for demos: don't change it unless asked, and never import from it.
- Never commit `.env` files; update the app's `.env.example` when adding an env var.
- A change spanning API + UI goes in one branch/PR. Keep `main` deployable.
- Database schema/migration/seed changes against the real (Neon) database need explicit approval before running — not just before committing.

## How the apps connect

- The frontend talks to the backend only through `staypookie-frontend/src/services/http/*`, enabled when `VITE_API_BASE_URL` is set (e.g. `http://localhost:4000/api/v1`). The mobile app does the same through `mobile/src/api/*` (`EXPO_PUBLIC_API_BASE_URL`).
- The contract is `staypookie-frontend/src/services/interfaces.ts` + `src/types/domain.ts`. Backend JSON field names, enum values and error codes match these 1:1 — change both sides together. `mobile/src/contract/` holds generated copies: after changing the contract run `npm run sync:contract` in `mobile/` (its `check:contract` fails otherwise). Mobile-only endpoints (`/devices`, `/app/config`) are typed in `mobile/src/contract/mobile.ts`.
- Response envelope: `{ data, error: { code, message, fieldErrors } | null, meta }`. Error codes: `VALIDATION · NOT_FOUND · FORBIDDEN · CONFLICT · UNAUTHENTICATED · EXPIRED · NOT_IMPLEMENTED (501) · NOT_CONFIGURED (503)`. The last two mean "not built / integration not set up" and must be shown as unavailable, never as success.
- Every module now has a real backend (auth, properties, rooms/beds, students, payments, notifications, activity, analytics, complaints, leave, visitors, maintenance, inventory, announcements, events, staff, feedback, documents, settings, search, emergency, uploads, invitations) — the real app has no mock data anywhere. The `AVAILABLE` gate in `staypookie-frontend/src/lib/features.ts` is kept only so a future module can ship UI before its backend lands.
- Owners are scoped to their Organization; managers to their property; students to their own records. Enforced in the API and, for cross-organization links, in the database.

## Running locally

```bash
cd backend && npm run dev            # :4000, needs backend/.env + Postgres
cd staypookie-frontend && npm run dev    # :5173
cd mobile && npm start                   # Expo; set EXPO_PUBLIC_API_BASE_URL to your LAN IP in mobile/.env
```

Demo logins (dev seed only, `npm run db:seed`): `owner@demo.com` / `manager@demo.com` / `student@demo.com`, password `meraki@123`. The API has no demo login; the prototype (`prototype/`, port 5174) is the only mock-data demo.

## Verifying a change

- Frontend: `npm run typecheck && npm run lint && npm run build && npm run check:bundle` in `staypookie-frontend/`.
- Backend: `npm run test:db:up && npm run test:strict` in `backend/` (disposable Postgres, never the dev or prod DB — the test harness also refuses to run against anything but a local database whose name ends in `_test`; `test-db.sh` uses Docker, but any local Postgres reachable at a `*_test` database works).
- Mobile: `npm run verify` in `mobile/` (contract check + typecheck + lint + tests), then click through on a phone.
- Prototype: `npm run build && npm run check:isolation` in `prototype/`.
- For cross-cutting changes, run both and click through the affected role's pages.

## Deploy

Each app deploys separately with its folder as the base/root directory: frontend and prototype → static host (Netlify, `netlify.toml` in each); backend → Node host (see `backend/CLAUDE.md`); mobile → EAS Build / app stores (see `mobile/CLAUDE.md`).
