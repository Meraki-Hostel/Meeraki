# 04 — Working Conventions

Read before changing code. Not suggestions.

## Golden rules

1. **Respect app boundaries:** `prototype/` = mock only; `staypookie-frontend/` = real API only, no mock, no fake success; a module without a backend stays **unavailable**, never faked.
2. **Server owns the truth** — permissions/scope are enforced in the API from the token, never trusted from the client.
3. **DB changes need a yes first** — any Prisma schema/migration/seed change against the real (Neon) DB is approved before it runs.
4. **Never commit `.env`** — add new config to `.env.example` with a comment.

## Git / PR workflow

- `main` is always deployable. Branch per change: `feat/…`, `fix/…`, `chore/…`.
- A change touching both API and UI goes in **one PR**.
- **Never commit, merge, or push unless explicitly asked** — open a PR, let a human review.
- Fill in the PR template.

## Definition of done

- [ ] Runs in the **real app** (not just tests) — you clicked through it.
- [ ] `npm run typecheck` and `npm run lint` pass (frontend).
- [ ] `npm test` passes if backend changed.
- [ ] Roadmap/todo doc updated in the same change.
- [ ] No `.env`, secrets, or mock data leaked into the real app.
- [ ] No AI/assistant attribution added to commits, PRs, code, or docs.

## Handy commands

```bash
# Backend (from backend/)
npm run dev            # API with --watch on :4000
npm test
npm run prisma:migrate # dev migration — needs approval

# Frontend (from staypookie-frontend/)
npm run dev            # Vite on :5173
npm run typecheck
npm run lint
npm run build
```

> Node lives at `/opt/homebrew/bin` on this machine —
> `export PATH="/opt/homebrew/bin:$PATH"` if a terminal can't find it.

_Last reviewed: 2026-11-08_
