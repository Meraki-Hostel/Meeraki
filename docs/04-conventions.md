# 04 — Working Conventions

The rules that keep the system clean. Read before changing code. These are not
suggestions — breaking them is how things get messed up.

## Golden rules

1. **Respect the app boundaries** (see [02-architecture.md](02-architecture.md)):
   - `prototype/` = mock data only.
   - `staypookie-frontend/` = real API only, no mock data, no fake success.
   - A module without a backend stays **unavailable** — never fake it.
2. **Server owns the truth.** Permissions and scope are enforced in the API from
   the token. The frontend never grants itself access.
3. **Database changes need a yes first.** Any Prisma schema change, migration, or
   seed against the real (Neon) DB is approved before it runs.
4. **Never commit `.env`.** Add new config to `.env.example` with a comment.

## Git / PR workflow

- `main` is always deployable. **Branch per change**: `feat/…`, `fix/…`, `chore/…`.
- A change that touches **both API and UI goes in one PR**.
- **Do not commit, merge, or push unless explicitly asked.** Open a PR and let a
  human review.
- Fill in the PR template.

## Finishing a piece of work (definition of done)

A change is done when:

- [ ] It runs in the **real app** (not just tests) and you clicked through it.
- [ ] Types pass (`npm run typecheck`) and lint passes (`npm run lint`) in the frontend.
- [ ] Backend tests pass (`npm test`) if backend changed.
- [ ] The roadmap / todo doc is updated in the same change.
- [ ] No `.env`, secrets, or mock data leaked into the real app.

## Handy commands

```bash
# Backend (from backend/)
npm run dev          # API with --watch on :4000
npm test             # run tests
npm run prisma:migrate   # dev migration (DB change — needs approval)

# Frontend (from staypookie-frontend/)
npm run dev          # Vite on :5173
npm run typecheck
npm run lint
npm run build
```

> On this machine Node is at `/opt/homebrew/bin`. If a terminal says "node not
> found", prepend it: `export PATH="/opt/homebrew/bin:$PATH"`.

## Writing & memory hygiene

- Keep docs honest and dated. Fix a doc in the same PR as the code it describes.
- Don't add AI/assistant attribution to commits, PRs, code, or docs.

_Last reviewed: 2026-11-07_
