# StayPookie — Hostel Management

Monorepo with three independently deployable apps:

| Folder | What | Stack | Deploy |
| --- | --- | --- | --- |
| [`staypookie-frontend/`](staypookie-frontend) | The real web app (Owner, Manager/Warden, Student) | React + Vite + TypeScript | Static site (Netlify/Vercel), base directory `staypookie-frontend` |
| [`backend/`](backend) | REST API for web and mobile | Node + Express + Prisma + PostgreSQL | Node host (Render/Railway/Fly), root directory `backend` |
| [`prototype/`](prototype) | Original clickable prototype, kept for demos | React + Vite, mock data only | Static site, base directory `prototype` |

Each folder has its own `package.json` and README; there is no shared root install.

## Run the real app locally

Needs Node 22+ and Docker (for the local database).

```bash
# 1. Database (repo root): PostgreSQL 16 on 127.0.0.1:5433, data kept in a Docker volume
docker compose up -d db

# 2. API
cd backend
npm install
npx prisma generate
cp .env.example .env        # then set DATABASE_URL / DIRECT_URL to
                            # postgresql://staypookie:staypookie_local_dev@127.0.0.1:5433/staypookie_dev
                            # and two random JWT secrets
npm run prisma:deploy       # create the tables
npm run db:seed             # demo data for every screen (first time only)
npm run dev                 # http://localhost:4000/ready

# 3. Frontend (new terminal)
cd staypookie-frontend
npm install
echo VITE_API_BASE_URL=http://localhost:4000/api/v1 > .env.local
npm run dev                 # http://localhost:5173
```

Locally, payments are simulated (no money moves), emails are printed in the API
terminal (password-reset and invitation links appear there), and uploaded files
are kept in `backend/uploads`. Switch to Razorpay, Resend and Cloudflare R2 in
`backend/.env` (see `backend/README.md`).

Stop the database with `docker compose down` (data kept); `docker compose down -v` deletes it.

Sign in with `owner@demo.com`, `manager@demo.com` or `student@demo.com` (password `meraki@123`).

## What's on the real API

Everything the app shows: accounts and invitations, properties, rooms and beds,
residents, billing (automatic monthly rent, late fees, deposits, refunds, PDF
receipts), online rent through Razorpay, complaints, leave, visitors,
maintenance, inventory, staff, notices, events, feedback, documents (Cloudflare
R2), emergency alerts, analytics, settings, plans and search. See
`backend/README.md` for setup, configuration and the endpoint list.

## Working in this repo

- `main` is always deployable. Branch per change (`feat/…`, `fix/…`) and open a PR.
- A change that touches both API and UI goes in one PR.
- Never commit `.env` files. Each app ships a `.env.example` instead.
