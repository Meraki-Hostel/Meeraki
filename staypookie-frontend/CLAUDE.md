# staypookie-frontend

The real StayPookie web app. React 18 + TypeScript (strict) + Vite 6 + React Router 6 + Tailwind CSS 4, Lucide icons, Recharts. No component framework. See the repo-root `CLAUDE.md` for monorepo rules and `../BACKEND_HANDOFF.md` for the API's auth flow, response envelope and endpoints by module.

## Commands

```bash
npm run dev         # http://localhost:5173
npm run typecheck   # tsc -b --noEmit
npm run lint        # eslint
npm run build       # typecheck + vite build (fails without VITE_API_BASE_URL)
npm run check:bundle  # after build: no mock code / demo markers in dist/
```

Run typecheck + lint + build + check:bundle before calling a change done. `qa/*.py` are the old mock-mode browser checks; they only run against the `archive/frontend-mock` tag (see `qa/README.md`).

## Layout

```
src/app/          router (lazy per role), providers (Session, Toast, Confirm)
src/components/   ui/ (design system), layout/ (AppShell, nav, guards), domain/ (Receipt, BedPicker…), brand/
src/features/     auth/, owner/, manager/, student/, shared/, common/  ← pages
src/services/     interfaces.ts (contracts), index.ts (container), http/* (real API), unavailable.ts, errors.ts
                  (the old mock layer is deleted; it survives only in git tag archive/frontend-mock)
src/hooks/        useQuery, useMutation
src/lib/          clock (real date, Asia/Kolkata), features (which modules have a backend), razorpay (Checkout), format, validation, export
src/types/        domain.ts — every entity and enum
```

Import alias: `@/` → `src/`.

## Data layer — the key rules

- This is the real app only. No mock fallback, no per-module switching, no demo login. The mock-data prototype is `/prototype`.
- Pages call `services.*` only, through `useQuery` / `useMutation`. Never import `mock/*`, `repository.ts` or fixtures (`npm run check:bundle` fails if anything does).
- `src/services/index.ts`: every module is wired to a real http adapter — `unavailable(...)` (rejects with `NOT_IMPLEMENTED`) exists for the rare case a module ships UI before its backend lands, not as a standing state. Never return made-up data or a fake success.
- `src/lib/features.ts`'s `AVAILABLE` gate currently lists every module as available; keep adding new modules there so the gate still does something the day one is built UI-first.
- Services throw `ServiceError` (`src/services/errors.ts`). `NOT_IMPLEMENTED` / `NOT_CONFIGURED` come from the API; `UNAVAILABLE` is client-side (network down, 5xx, non-envelope reply). `useMutation` maps `fieldErrors` onto form fields.
- Pages refresh through `subscribeToData`, which fires after every successful non-GET HTTP call. Don't add manual refetches.

## Payments

- Online rent payment goes through Razorpay Checkout (`src/lib/razorpay.ts`), used from the student rent page. The flow: `payments.payNow()` creates a gateway order, Checkout collects the payment, then the browser calls `/payments/verify` — the balance only updates once the server has confirmed it (via `/payments/verify` or the webhook), never on the client's say-so.
- If the backend's `PAYMENT_MODE` is `disabled`, pay-now answers `NOT_CONFIGURED` and the UI should say online payment isn't set up yet, not fail silently.

## Adding a backend-backed module

1. Add the adapter in `src/services/http/` implementing the existing `I*Service` interface with `http.get/post/patch/del`.
2. Wire it into `services/index.ts` in place of `unavailable(...)`.
3. Add/confirm the module in `AVAILABLE` in `src/lib/features.ts`; its menu entries, routes and dashboard figures come back.
4. Don't change the interface unless the backend changes too.

## Conventions

- `any` is a lint error; `alert()`/`confirm()` are banned — use toasts and `ConfirmDialog`.
- Format money/dates with `src/lib/format.ts`. "Today" and the billing month come from `src/lib/clock.ts`: the real date in Asia/Kolkata, matching the API's `APP_TIMEZONE`.
- Role scoping is enforced by the backend; client checks are only for UX.

## Env

`VITE_API_BASE_URL` in `.env` (gitignored); template in `.env.example`. Required: the build fails without it. Netlify needs it set at build time, pointing at the deployed API's `/api/v1`.
