# 01 — Vision & Target

> **For review.** This is a complete draft, not a blank. The business calls
> (exact launch date, pricing, which hostel is first) are yours — adjust the
> lines marked **[review]**. Everything else is grounded in how the app actually
> works today.

## What StayPookie is

StayPookie is a **hostel / PG management system** — one product, three kinds of
user, one backend API that serves both the web app and (later) a mobile app.

| Role                       | Who they are                | What they do in StayPookie                                |
| -------------------------- | --------------------------- | --------------------------------------------------------- |
| **Owner**            | Runs one or more properties | Sees the whole business: properties, occupancy, money in. |
| **Manager / Warden** | Runs a property day-to-day  | Assigns beds, records payments, handles student requests. |
| **Student**          | The resident                | Pays rent, sees their dues, raises complaints and leave.  |

The product is built for the **Indian hostel / PG market** — rent is in ₹, online
payments go through **Razorpay**, and dates use the `Asia/Kolkata` business day.

## The target

**A hostel owner can run their property end-to-end in StayPookie — no
spreadsheets, no paper.** Students are onboarded to beds, rent is collected
online and reconciled automatically, and the daily requests (complaints, leave,
visitors) are handled in one place that works on a phone.

- **Primary market :** student hostels and PGs in India, starting with
  small-to-mid properties (one owner, one or a few buildings).
- **First pilot [review]:** the **CV Raman** hostel — already seeded as the first
  owner in `backend/.env` (`OWNER_NAME=Pawan Kushwah`). Use it as the design
  partner and first real tenant.
- **Why it's worth paying for :** one dashboard that replaces the
  rent-register + WhatsApp + cash-book workflow, with **online rent collection**
  as the headline feature.
- **Launch:** public go-live **11 Nov 2026, 1:00 PM IST** (users can use the
  platform); internal/team cutoff **10 Nov 2026, 11:59 PM IST**. The full
  product (every module below) is already built — launch is now a deploy +
  verify problem, not a build problem. See [09-launch-checklist.md](09-launch-checklist.md).

## Milestones

The module build-out finished ahead of plan — every module listed here is live
(see [03-roadmap.md](03-roadmap.md)). What's left is proving it in the pilot.

1. **Core occupancy & money — done.** Owner signs up, adds a property, rooms
   and beds; assigns a student to a bed; records/collects rent online
   (Razorpay) or offline; sees payment history and receipts.
2. **Daily operations — done.** Complaints, leave, visitors, maintenance,
   inventory, staff, announcements, events, feedback, documents, settings,
   search, emergency alerts.
3. **Mobile.** The API is already mobile-ready; wrap the student experience in
   an app once the web product is proven in the pilot.

Alongside these, four **planned features** sharpen the product — postpaid rent,
printable student biodata, daily Google-Drive backup, and (last) a hostel
landing-page builder. These are genuinely not built yet. Details and
sequencing in [03-roadmap.md](03-roadmap.md) → _Planned features_.

## What "done" looks like — success criteria

The pilot is a success when, for one real hostel:

- [ ] The owner has onboarded every current resident to a bed in StayPookie.
- [ ] Rent for a month is collected and reconciled **inside the app**, not a
  spreadsheet.
- [ ] A student pays online and the owner sees it marked paid without manual entry.
- [ ] Students raise complaints / leave in the app and managers resolve them there.
- [ ] The owner would be unhappy to go back to their old workflow.

## Explicitly NOT the target (for now)

Saying no on purpose so scope doesn't creep:

- **No native mobile app yet** — web-first; the API is mobile-ready for later.
- **No accounting / GST / payroll** — StayPookie tracks rent, not full books.
- **No multi-language** — English first.
- **Not a marketplace** — we manage existing hostels; we don't help students find them.

## Who this is for

Internal north star for Pawan and anyone building StayPookie. Every roadmap item
and PR should trace back to the target above. If a task doesn't serve it,
question whether it belongs now.

_Last reviewed: 2026-11-08_
