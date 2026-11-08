# 01 — Vision & Target

> **For review.** Business calls — exact launch specifics, pricing, first
> hostel — are marked **[review]**. Everything else matches how the app works
> today.

## What StayPookie is

A **hostel / PG management system** — one backend API, three user roles.

| Role | Does |
| --- | --- |
| **Owner** | Runs one or more properties; sees occupancy and money across all of them. |
| **Manager / Warden** | Runs one property day-to-day: beds, payments, student requests. |
| **Student** | Pays rent, sees dues, raises complaints/leave. |

Built for the **Indian hostel/PG market**: ₹ rent, **Razorpay** online
payments, `Asia/Kolkata` business day.

## The target

A hostel owner runs their property end-to-end in StayPookie — no
spreadsheets, no paper. Students are onboarded to beds, rent is collected
online and reconciled automatically, and daily requests (complaints, leave,
visitors) are handled in one place that works on a phone.

- **Market:** small-to-mid Indian hostels/PGs (one owner, one or a few buildings).
- **First pilot [review]:** **CV Raman** hostel — seeded as the first owner in `backend/.env`.
- **Why pay for it:** one dashboard replacing rent-register + WhatsApp + cash-book, with online rent collection as the headline feature.
- **Launch:** public go-live **11 Nov 2026, 1 PM IST**, team cutoff **10 Nov, 11:59 PM IST**. Every module is built; what's left is deploy + verify — see [09-launch-checklist.md](09-launch-checklist.md).

## Status

Every module is live (see [03-roadmap.md](03-roadmap.md)) — the build-out
finished ahead of plan. What's left is proving it in the pilot:

1. **Core occupancy & money — done.**
2. **Daily operations — done** (complaints, leave, visitors, maintenance, inventory, staff, announcements, events, feedback, documents, settings, search, emergency).
3. **Mobile — later.** The API is already mobile-ready; wrap the student experience once the web product is proven.

Four **planned features** come after: postpaid rent, printable biodata,
Google-Drive backup, and a landing-page builder (last). Details in
[03-roadmap.md](03-roadmap.md).

## Success = the pilot works

- [ ] Every current resident onboarded to a bed.
- [ ] A month's rent collected and reconciled inside the app, not a spreadsheet.
- [ ] A student pays online; the owner sees it marked paid with no manual entry.
- [ ] Complaints/leave raised and resolved in-app.
- [ ] The owner wouldn't want to go back to their old workflow.

## Explicitly not the target (for now)

No native mobile app · no accounting/GST/payroll · no multi-language (English
first) · not a marketplace — we manage existing hostels, not help students
find them.

_Last reviewed: 2026-11-08_
