# Meraki — Hostel Management

Monorepo with three independently deployable apps:

| Folder | What | Stack | Deploy |
| --- | --- | --- | --- |
| [`meraki-frontend/`](meraki-frontend) | The real web app (Owner, Manager/Warden, Student) | React + Vite + TypeScript | Static site (Netlify/Vercel), base directory `meraki-frontend` |
| [`backend/`](backend) | REST API for web and mobile | Node + Express + Prisma + PostgreSQL | Node host (Render/Railway/Fly), root directory `backend` |
| [`prototype/`](prototype) | Original clickable prototype, kept for demos | React + Vite, mock data only | Static site, base directory `prototype` |

Each folder has its own `package.json` and README; there is no shared root install.

## Run the real app locally

```bash
# 1. API (needs PostgreSQL — local or Neon; see backend/README.md)
cd backend
npm install
cp .env.example .env        # fill in DATABASE_URL, DIRECT_URL, JWT secrets
npm run prisma:migrate
npm run db:seed
npm run dev                 # http://localhost:4000/health

# 2. Frontend (new terminal)
cd meraki-frontend
npm install
cp .env.example .env        # VITE_API_BASE_URL=http://localhost:4000/api/v1
npm run dev                 # http://localhost:5173
```

Sign in with `owner@demo.com`, `manager@demo.com` or `student@demo.com` (password `meraki@123`).

## What's on the real API so far

Auth, properties, rooms/beds, students, payments, complaints, leave,
notifications and activity. Visitors, maintenance, inventory, staff, announcements,
events, feedback, documents, analytics trends, settings and search have no
backend yet: the app hides them and shows "Not available yet" until their
modules are built. See `backend/README.md` → "Adding the remaining modules".

## Working in this repo

- `main` is always deployable. Branch per change (`feat/…`, `fix/…`) and open a PR.
- A change that touches both API and UI goes in one PR.
- Never commit `.env` files. Each app ships a `.env.example` instead.
