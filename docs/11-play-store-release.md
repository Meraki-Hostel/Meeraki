# 11 — Publishing the mobile app on Google Play

What it takes to put `mobile/` on Google Play, in order, with the text and answers Play asks
for. Scope and architecture are in [10-mobile-app.md](10-mobile-app.md). Items marked
**[you]** need an account, a credential or a business decision that only the owner can supply.

> **Status:** the app builds and passes its checks, but it has **never run on a phone**. The
> machine it was built on has no usable Android emulator, so the first real test is a cloud
> build installed on a device (step 5). Do not skip that.

## 1. What is ready, and what is not

| Item | State |
| --- | --- |
| App icon, adaptive icon, themed icon, splash | Done — from the web logo (`mobile/assets/`) |
| Play listing icon (512) and feature graphic (1024×500) | Done — `mobile/store/` |
| Release build config (AAB, API URL, Play submit track) | Done — `mobile/eas.json` |
| Unneeded permissions blocked (storage, audio, overlay) | Done — `app.config.ts` |
| Backups disabled for the sign-in token | Done |
| Crash screen instead of a blank screen | Done |
| Public privacy policy page `/privacy` (with deletion section) | Written; **[you]** review, set `VITE_SUPPORT_EMAIL`, deploy the web app |
| Store listing text, Data Safety, content rating answers | Drafted below; **[you]** confirm |
| Phone screenshots | **Not done** — need a running app (step 5) |
| Google Play developer account | **[you]** |
| Expo account and project (`eas init`) | **[you]** |
| Firebase project for Android push (`google-services.json`) | **[you]** |
| Demo accounts for Google's reviewers | **[you]** — see step 7 |
| Crash reporting (e.g. Sentry) | Not added; recommended before wide release |
| Tested on a real Android phone | **Not done** |

## 2. Decisions to make first **[you]**

- **Package name:** `com.staypookie.app` is the default. **It can never change after the first
  upload.** Override with `APP_BUNDLE_ID` before the first build if you want another.
- **App name:** `StayPookie` (`APP_NAME` to override).
- **Developer account type.** A personal Play account created recently must run a **closed test
  with at least 12 testers for 14 days** before it can publish to production; organization
  accounts are exempt. Check the current rule in Play Console, because it decides your timeline.
- **Support email** for the policy and the store listing (`VITE_SUPPORT_EMAIL`).
- **Target audience:** choosing **18 and over** avoids Play's families/children requirements.
  Hostel residents are mostly students; if you admit minors, talk to a lawyer first.

## 3. Accounts

1. Google Play Console: $25 one-time, identity verification takes days.
2. Expo account (free tier is enough to start) for EAS cloud builds.
3. Firebase project (free) for Android push notifications.

## 4. One-time setup

```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest init            # links the Expo project and writes the project id
```

Put the project id in your environment as `EAS_PROJECT_ID` (see `mobile/.env.example`); push
tokens need it.

**Push (FCM):**
1. Firebase console → create a project → add an **Android app** with your package name.
2. Download `google-services.json`. Upload it to EAS as a **file** environment variable named
   `GOOGLE_SERVICES_JSON` (Expo dashboard → Environment variables → File). It is read by
   `app.config.ts`. Never commit it (gitignored).
3. Firebase → Project settings → Service accounts → generate a private key (JSON). Upload it to
   Expo: `npx eas-cli@latest credentials` → Android → Google Service Account for FCM V1.
4. On the backend host (Render), set `PUSH_MODE=expo` (and `EXPO_ACCESS_TOKEN` if you turn on
   enhanced push security). Leave it unset to keep push off.

**Signing:** let EAS create and store the upload keystore when prompted at the first
production build. Keep Play App Signing on (the default).

## 5. Build and test on a real phone

```bash
npx eas-cli@latest build --platform android --profile preview      # an installable APK
```

Install the APK, then click through **each role** against the live API (or a staging copy).
Check at least: sign-in, rent payment (Razorpay), complaint with a camera photo, document
upload, receipt PDF, notification arrives and opens the right screen, sign-out. Take
**screenshots** here: Play needs at least 2 phone screenshots (up to 8), 16:9–9:16.

> The `preview` and `production` profiles point at the live API
> (`https://staypookie.onrender.com/api/v1`). There is no staging server, so test payments in
> Razorpay **test mode**, or use a hostel you control.

## 6. Production build and upload

```bash
npx eas-cli@latest build --platform android --profile production   # an .aab, versionCode auto-increments
npx eas-cli@latest submit --platform android --profile production  # to the internal track, as a draft
```

`submit` needs a Play **service-account key** (Play Console → Setup → API access) saved as
`mobile/google-service-account.json` (gitignored). The very first upload must be made by hand in
Play Console; after that `submit` works. In the build output, confirm the **target SDK** meets
Play's current minimum (Expo SDK 58 sets this).

Release path: **internal testing → closed testing → production**. Bump `version` in
`mobile/app.config.ts` for each store release; raise the API's `MOBILE_MIN_VERSION` only when the
API makes a breaking change (older apps then show "Update required").

## 7. Play Console: the App content section

### App access (required — the app needs a login)
Google's reviewers must be able to sign in. Provide credentials for **three demo accounts**
(resident, manager, owner) in a demo hostel. The production API has no demo login by design, so
create a demo organization and users in the production database through the normal admin
flow, and keep it separate from real hostels. **[you]**

### Privacy policy
`https://<your web app>/privacy`. Also fill "Account deletion" with `https://<your web app>/privacy#deletion`.
(Accounts are created by the hostel, not in the app, so Play's in-app deletion rule does not apply,
but the policy still explains how to request deletion.)

### Data safety (declare all of this)
Data is encrypted in transit: **yes**. Users can request deletion: **yes**. No data is sold or
used for ads. Nothing is shared with third parties for their own purposes; the hosting,
notification and payment providers act as service providers.

| Data type | Collected | Why | Optional? |
| --- | --- | --- | --- |
| Name, email address, phone number | Yes | Account management, app functionality | No |
| Home address | Yes | App functionality (resident profile) | Yes |
| Other personal info (date of birth, gender, blood group, guardian/emergency contacts, college) | Yes | App functionality | Partly |
| Photos | Yes | Complaint and document attachments | Yes (only if you attach) |
| Files and docs (ID proof, agreements, certificates) | Yes | App functionality | Hostel may require |
| Payment info (purchase history) | Yes — amounts, dates, references | App functionality | No |
| Card/UPI details | **No** — entered in Razorpay's checkout; we never see them | — | — |
| Device or other IDs (push token) | Yes | App functionality (notifications) | Yes |
| Messages (complaint comments, feedback, emergency text) | Yes | App functionality | Yes |
| App activity, crash logs, diagnostics | Server logs only; no analytics or crash SDK | Security | — |
| Location | **No** | — | — |
| Contacts, calendar, audio, health | **No** | — | — |

If you add crash reporting (Sentry) or analytics later, update this table **and** the policy.

### Permissions the app requests
- **Camera** — photograph a problem for a complaint, or a document. Only when you tap the button.
- **Notifications** (Android 13+) — rent reminders, request updates, notices.
- Internet access. No location, contacts, microphone or storage permission.

### Other declarations
- **Ads:** none. **Government app:** no. **Health app:** no. **News app:** no.
- **Financial features:** declare that the app lets users pay rent to their hostel through a payment
  gateway (Razorpay). It is not a lending, banking, crypto or investment app.
- **Content rating** (IARC questionnaire): category *Utility/Productivity*. No violence, sexual
  content, profanity, gambling or drugs. Users do not exchange content with each other (complaints
  and feedback go only to hostel staff). Expected result: suitable for everyone.
- **Category:** *House & Home* (alternative: *Productivity*). **Tags:** hostel, PG, rent.
- **Target audience:** 18 and over (see step 2).

## 8. Store listing text

**App name** (max 30): `StayPookie`

**Short description** (max 80): `Pay rent, raise complaints and read hostel notices from your phone.`

**Full description** (max 4000):

```
StayPookie is the app for your hostel or PG, for residents, wardens and owners. Your hostel adds you, then you sign in with the email or phone number it registered.

FOR RESIDENTS
• See your rent dues and pay online, then download your receipt
• Raise complaints with photos and follow them until they are fixed
• Apply for leave and register visitors
• Read notices from the hostel and get alerts on your phone
• Keep your contact and emergency details up to date, and upload documents the hostel asks for
• Send an emergency alert to the warden in one tap

FOR WARDENS AND MANAGERS
• Approve or reject leave and visitor requests, and log walk-in visitors
• See who owes rent, record payments and send reminders
• Handle complaints and maintenance tickets, and update stock
• Post announcements and respond to emergency alerts
• Look up residents and see which beds are free

FOR OWNERS
• See occupancy and rent collection across your hostels
• Follow complaints, staff and events

Accounts are created by your hostel; there is no public sign-up. Online payments are processed by Razorpay and are available only where your hostel has enabled them. Setup tasks such as admissions, rooms and payout accounts stay in the StayPookie web app.
```

**Graphics:** icon `mobile/store/play-icon-512.png`, feature graphic
`mobile/store/feature-graphic-1024x500.png`, phone screenshots from step 5.

## 9. Before you click "Publish to production"

- [ ] Tested on a real Android phone, every role (step 5)
- [ ] `/privacy` is live on the deployed web app and the support email is set
- [ ] Demo accounts for reviewers exist and work
- [ ] Data safety, content rating, target audience, financial features, app access all completed
- [ ] Firebase push works from a release build (a real notification arrives)
- [ ] Neon database has a backup, and the Render service has `NODE_ENV=production`
- [ ] Closed-test requirement met if your account needs it
- [ ] Release notes written ("First release")

_Last reviewed: 2026-11-13_
