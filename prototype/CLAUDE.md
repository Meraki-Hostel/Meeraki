# prototype — frozen demo

The original frontend-only StayPookie prototype, kept for product demos and scope validation. **Not the production app** — real work goes in `../staypookie-frontend` and `../backend`. See the repo-root `CLAUDE.md`.

- Don't modify this folder unless explicitly asked, and don't port code from it without checking `staypookie-frontend` has no equivalent.
- No backend: all data is seeded in `src/data/seed.ts`, held in a single client store (`src/store/AppStore.tsx`, derived values in `src/store/selectors.ts`) and persisted to `localStorage`.

## Commands

```bash
npm run dev       # http://localhost:5173
npm run lint      # oxlint
npm run build     # tsc -b + vite build
npm run check:isolation  # confirms it never imports from staypookie-frontend or backend
```

## Layout

`src/pages/{student,manager,owner}` role screens · `src/components/{ui,domain,layout,charts}` · `src/lib` types/utils/analytics.

Stack differs from staypookie-frontend: React 19, oxlint (not ESLint), `clsx`. Demo calendar is fixed to 25 Sep 2026 (`DEMO_TODAY` in `src/lib/utils.ts`).

Deploy: Netlify with base directory `prototype` (`netlify.toml` here).
