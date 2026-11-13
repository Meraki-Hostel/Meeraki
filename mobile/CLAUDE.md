# mobile — StayPookie app (Android + iOS)

Expo SDK 58 + React Native 0.88 + TypeScript (strict) + Expo Router + TanStack Query. One app for all three roles; the role comes from sign-in. Talks only to the API (`backend/`). See the repo-root `CLAUDE.md` for monorepo rules, `../BACKEND_HANDOFF.md` for the API, and `../docs/10-mobile-app.md` for scope and what stays on the web.

## Commands

```bash
npm start                 # Expo dev server (scan the QR with a dev build, see below)
npm run android | ios     # build and run a dev build locally (needs Android Studio / Xcode)
npm run typecheck         # tsc --noEmit
npm run lint              # expo lint (eslint-config-expo)
npm test                  # jest-expo unit tests
npm run check:contract    # fails if src/contract/ is out of date with the web app
npm run sync:contract     # copy the contract from staypookie-frontend
npm run verify            # check:contract + typecheck + lint + test — run before calling a change done
```

Expo Go is not enough: Razorpay and push need a **development build** (`npm run android`, or `npx eas-cli@latest build --profile development`). Everything else runs in Expo Go.

## Expo changes every SDK — check the docs

APIs move between SDKs. Before using an Expo/EAS/React Native API, check the docs for the SDK in `package.json` (https://docs.expo.dev/versions/v58.0.0/, index at https://docs.expo.dev/llms.txt). Add packages with `npx expo install <pkg>` (picks SDK-compatible versions), never plain `npm install`, except for libraries Expo doesn't know (`react-native-razorpay`). Notable SDK 58 specifics used here: `expo-file-system`'s `File`/`Paths` API (the old functions live in `/legacy`), `ImageManipulator.manipulate().renderAsync()`, image-picker `mediaTypes: ['images']`, `Stack.Protected`, and foreground notifications shown by default.

`ios/` and `android/` are generated (CNG) and gitignored — configure native behaviour in `app.config.ts`, never by hand.

## Layout

```
src/app/            Expo Router routes. Paths mirror the web app: /student/*, /manager/*, /owner/*
  _layout.tsx       providers, update gate, role guards (Stack.Protected), push-tap routing
  student/ manager/ owner/   each: _layout (Stack) + (tabs)/ + detail screens
src/contract/       domain.ts + interfaces.ts GENERATED from the web app (never edit); mobile.ts hand-written
src/api/            client.ts (envelope, errors, single-flight refresh), services.ts, files.ts (upload/download), tokens.ts
src/auth/           session.tsx — sign-in state, cold start, sign-out (unregisters push first)
src/push/           register.ts — permission, Expo push token, POST /devices
src/features/       screens shared by roles (Me, complaint detail/queue, update gate)
src/components/     ui.tsx (design system), theme.ts (web palette), RoleTabs, DateField, Decision
src/lib/            format (₹, Asia/Kolkata dates), links (notification link → app route), labels, razorpay, version
```

Import alias: `@/` → `src/`.

## Rules

- **API only.** No mock data, no fake success, no demo login. The mock prototype is `/prototype`.
- **The contract is the web app's.** `src/contract/{domain,interfaces}.ts` are copies; change `staypookie-frontend/src/...` and run `npm run sync:contract`. `services.ts` types every call with `Pick<I*Service, ...>`, so a contract change breaks typecheck here. Mobile-only shapes (`/devices`, `/app/config`, phone files instead of `File`) go in `contract/mobile.ts`.
- **Errors:** `NOT_IMPLEMENTED` / `NOT_CONFIGURED` mean "not set up on this server" — show as unavailable (`ErrorState`/`Notice` do this), never as success or as the user's fault. `UNAVAILABLE` is offline.
- **Auth:** access token in memory only, refresh token in SecureStore only. Never call `/auth/refresh` except through `refreshSession()` — the API revokes every session if an old refresh token is reused, so refreshes must be single-flight.
- **Writes** go through `useAction`; on success every query is invalidated (the web app's `subscribeToData` rule). Don't add manual refetches.
- **Payments:** the app never decides a payment succeeded. `lib/razorpay.ts` → `/payments/pay-now` → Checkout → `/payments/verify`; `processing` is a valid outcome (the webhook confirms).
- **Uploads:** photos are re-encoded to JPEG ≤1600 px; the declared size must equal the uploaded bytes (the API checks).
- **Notification links** are web paths. When the web nav or a backend link changes, update `src/lib/links.ts` and its test.
- Role checks in the app are UX only; the API enforces every rule.
- `alert()` is banned; use `Alert.alert` for confirmations and `Notice` for inline errors.

## Env

`.env` (gitignored), template `.env.example`: `EXPO_PUBLIC_API_BASE_URL` (required; LAN IP, not localhost, on a phone), `EXPO_PUBLIC_WEB_URL`, store URLs, and build-time `EAS_PROJECT_ID` / `APP_NAME` / `APP_BUNDLE_ID`. `EXPO_PUBLIC_*` values are compiled into the app — never a secret. Read them with dot access (`process.env.EXPO_PUBLIC_X`), or Expo won't inline them.

## Release

EAS profiles in `eas.json`: `development` (dev client), `preview` (internal APK/IPA), `production` (stores, auto-incremented build numbers). Bump `version` in `app.config.ts` for a store release; raise the API's `MOBILE_MIN_VERSION` only for a breaking API change.
