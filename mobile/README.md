# StayPookie mobile app

The Android and iOS app for StayPookie, for residents, managers/wardens and owners. Built with Expo (SDK 58). It talks to the same API as the web app. Plan and scope: [`docs/10-mobile-app.md`](../docs/10-mobile-app.md).

## Run it locally

You need Node 20+, the backend running, and a phone or emulator.

1. Start the API (`cd backend && npm run dev`). For push, set `PUSH_MODE=console` (the dev default); pushes are logged instead of sent.
2. Configure the app:
   ```bash
   cd mobile
   npm install
   cp .env.example .env
   ```
   In `.env`, set `EXPO_PUBLIC_API_BASE_URL` to your computer's **LAN IP**, e.g. `http://192.168.1.10:4000/api/v1`. On a phone, `localhost` means the phone itself.
3. Start it:
   ```bash
   npm start          # then press a (Android emulator) or scan the QR code
   ```
   Expo Go works for most screens. Online payment (Razorpay) and push notifications need a **development build**:
   ```bash
   npm run android    # or: npm run ios (macOS + Xcode)
   ```

Demo logins come from the backend's dev seed (`npm run db:seed`): `student@demo.com`, `manager@demo.com`, `owner@demo.com`, password `meraki@123`. Pick the matching role on the sign-in screen.

## Check a change

```bash
npm run verify     # contract up to date + typecheck + lint + unit tests
```

Then click through the affected role on a real phone against a local API.

## What's in the app

| Role | Screens |
| --- | --- |
| Resident | Home, rent (pay online, receipts), complaints with photos, leave, visitors, notices, profile, documents, feedback, emergency |
| Manager / warden | Today, approvals (leave, visitors, complaints), walk-in visitors, dues + record payment + reminders, maintenance, inventory, announcements, emergency alerts, residents and rooms (read-only) |
| Owner | Dashboard and trends, finance (read-only), complaints, properties, staff, events |

Admission, room setup, staff management, payout accounts, plans and settings stay on the web app.

## Builds and releases

[EAS](https://docs.expo.dev/eas/) builds in the cloud; no local Xcode or Android Studio is needed for store builds.

```bash
npx eas-cli@latest init                              # once: links the Expo project, writes the project id
npx eas-cli@latest build --profile preview           # installable test build
npx eas-cli@latest build --profile production        # store build
npx eas-cli@latest submit --platform android|ios     # upload to the stores
```

Push notifications need FCM (Android) and APNs (iOS) credentials, set with `npx eas-cli@latest credentials`, and the API running with `PUSH_MODE=expo`.
