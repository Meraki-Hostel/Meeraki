import { BrandLogo } from '@/components/brand/BrandLogo';

// Public (no sign-in): Google Play and the app stores require a privacy policy at a public URL.
// Keep this in step with what the app really collects (docs/11-play-store-release.md has the
// Data Safety answers) and have it reviewed before publishing.
const UPDATED = '13 November 2026';
const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim();

interface Section { id?: string; title: string; body: string[]; list?: string[] }

const SECTIONS: Section[] = [
  {
    title: 'What StayPookie is',
    body: [
      'StayPookie is hostel and PG management software used by hostel owners, wardens and residents, on the web and in the StayPookie mobile app. Your hostel creates your account and adds you to a bed; there is no public sign-up. We process your information to run the hostel on its behalf.',
    ],
  },
  {
    title: 'Information we handle',
    body: ['Depending on your role, the app handles:'],
    list: [
      'Account details: your name, email address, phone number and role. Your password is stored only as a one-way hash.',
      'Resident profile (added by the hostel, some editable by you): student code, date of birth, gender, college and course, home address, blood group, guardian and emergency contact names and numbers, room and bed.',
      'Documents you upload when the hostel asks for them, for example ID proof, admission letter, photo, police verification, rent agreement or medical certificate.',
      'Requests you make: complaints (including photos you choose to attach), leave requests, visitor registrations (visitor name, phone and relation), feedback, and emergency alerts (including the text you type for what and where).',
      'Rent and payments: dues, payment amounts, dates, receipt numbers, and the reference the payment gateway returns.',
      'Notification details: a push-notification token for your phone, the phone type (Android or iOS) and the app version, so we can send you alerts you have allowed.',
      'Technical logs: standard server logs such as time, request path and IP address, used to keep the service running and secure.',
    ],
  },
  {
    title: 'What we do not collect',
    body: [
      'We do not collect your precise location, contacts, microphone recordings, or advertising identifiers. The camera is used only when you choose to take a photo for a complaint or a document. We do not show ads, we do not sell your information, and the app has no third-party advertising or analytics trackers.',
    ],
  },
  {
    title: 'How we use it',
    body: [
      'To run your stay: show your dues and receipts, handle complaints, leave and visitor requests, deliver notices and reminders, and let wardens respond to emergencies. To keep the service secure and fix problems. To meet legal obligations.',
    ],
  },
  {
    title: 'Payments',
    body: [
      'Online rent payments are made through Razorpay. You enter card, UPI or net-banking details directly in Razorpay’s checkout; StayPookie does not see or store them. We keep only the amount, status and the reference Razorpay returns, so your dues and receipts stay correct.',
    ],
  },
  {
    title: 'Who can see your information',
    body: ['Your information is visible only to people who need it:'],
    list: [
      'Your hostel’s wardens and its owner. Residents see only their own records. A warden sees residents of their own hostel; an owner sees the hostels of their own organization.',
      'Service providers that host and run the app for us, such as our cloud hosting and database providers, file storage, the Expo push-notification service that delivers alerts to your phone, an email provider for emails you request (for example a password reset), and Razorpay for payments. They process data only to provide those services.',
      'Authorities, where the law requires it.',
    ],
  },
  {
    title: 'Security',
    body: [
      'Data travels over encrypted connections (HTTPS). Passwords are hashed. On your phone, your sign-in is kept in the device’s secure storage and is not included in phone backups. Access is limited by role, and the server enforces those limits on every request.',
    ],
  },
  {
    title: 'How long we keep it',
    body: [
      'We keep your information while you are a resident and for as long as your hostel needs its records, for example rent and receipt records for accounting, or as the law requires. After that it is deleted or anonymized.',
    ],
  },
  {
    id: 'deletion',
    title: 'Your choices, access and deletion',
    body: [
      'You can see and update your contact and emergency details in the app (Me › My profile). You can turn off push notifications in your phone’s settings at any time, and signing out removes this phone from our notification list.',
      'To ask for a copy of your information, a correction, or deletion of your account and data, contact your hostel office, or us' + (SUPPORT_EMAIL ? ` at ${SUPPORT_EMAIL}` : ' through your hostel') + '. We will verify it is you, then delete or anonymize your personal data, except records we must keep by law (such as payment records), which we keep only as long as required.',
    ],
  },
  {
    title: 'Children',
    body: [
      'The app is for hostel residents, wardens and owners, and accounts are created by the hostel. It is not directed at young children. If a resident is a minor, the hostel is responsible for registering them with their guardian’s knowledge.',
    ],
  },
  {
    title: 'Changes to this policy',
    body: ['If we change this policy we will update this page and the date below. Significant changes will also be announced in the app.'],
  },
  {
    title: 'Contact',
    body: [SUPPORT_EMAIL ? `Questions or requests: ${SUPPORT_EMAIL}.` : 'For questions or requests, contact your hostel office.'],
  },
];

export function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-ivory">
      <header className="mx-auto flex h-16 max-w-3xl items-center px-6"><a href="/login" aria-label="StayPookie home"><BrandLogo /></a></header>
      <main className="mx-auto max-w-3xl px-6 pb-20 pt-4">
        <h1 className="font-display text-3xl font-semibold text-espresso">Privacy policy</h1>
        <p className="mt-1 text-sm text-dust">Last updated {UPDATED}</p>
        <nav aria-label="Contents" className="mt-6 rounded-xl border border-line bg-cream p-4 text-sm">
          <a href="#deletion" className="font-medium text-clay-600 underline">Delete my account or data</a>
        </nav>
        {SECTIONS.map((s) => (
          <section key={s.title} id={s.id} className="mt-8 scroll-mt-6">
            <h2 className="text-lg font-semibold text-espresso">{s.title}</h2>
            {s.body.map((p) => <p key={p} className="mt-2 leading-relaxed text-bark">{p}</p>)}
            {s.list && (
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-bark">
                {s.list.map((li) => <li key={li} className="leading-relaxed">{li}</li>)}
              </ul>
            )}
          </section>
        ))}
      </main>
    </div>
  );
}
