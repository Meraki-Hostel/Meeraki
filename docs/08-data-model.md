# 08 — Data Model & API Reference

The shared language of the system. If two people mean different things by
"charge" vs "payment", things get messed up — so this is the single glossary.

_Source of truth: `backend/prisma/schema.prisma` and `backend/src/modules/*`._

## Entities (the nouns)

How they relate, top to bottom:

```
Organization  (the hostel business / tenant boundary)
 ├─ User            (login: Owner / Manager / Warden / Student)
 │   └─ RefreshToken (hashed, rotated, revocable)
 ├─ Invitation      (invite a user into the org; has a token + status)
 └─ Property        (a building/hostel)
     ├─ Room        (has a RoomType + RoomStatus)
     │   └─ Bed     (the unit a student is assigned to; has BedStatus)
     ├─ StudentProfile  (a resident; linked to a User + a Bed)
     ├─ StaffMember     (StaffRole, Shift, StaffStatus)
     └─ RentCharge      (what a student owes for a period)
         └─ Payment     (money received against charges; PaymentStatus/Method)

Cross-cutting: Counter (receipt/number sequences) ·
Notification (per-user) · ActivityLog (audit trail of actions)
```

### Glossary

| Entity | Plain meaning |
| --- | --- |
| **Organization** | One hostel business. The **tenant boundary** — every record belongs to one org, and the server scopes all access to the caller's org. |
| **User** | Anyone who logs in. A `Role` decides what they can do. |
| **Invitation** | A pending invite to join an org (token + `InvitationStatus`). |
| **Property** | A building/hostel the org runs (`PropertyType`, `PropertyStatus`). |
| **Room** | A room in a property (`RoomType`, `RoomStatus`). |
| **Bed** | The assignable unit inside a room (`BedStatus`). Students occupy beds. |
| **StudentProfile** | A resident's details, tied to a `User` and a `Bed`. |
| **StaffMember** | A non-student worker (`StaffRole`, `Shift`, `StaffStatus`). |
| **RentCharge** | An amount a student owes for a period — the bill. |
| **Payment** | Money received (`PaymentMethod`, `PaymentStatus`). Reconciled against charges. For online, **paid state is confirmed only by the Razorpay webhook**. |
| **Counter** | Sequence generator (e.g. receipt numbers) so numbers don't collide. |
| **Notification** | A per-user message/alert. |
| **ActivityLog** | Audit trail — who did what, for the activity feed. |

This covers the **core** entities (occupancy + money). Each of the 12
daily-operations modules (Complaints, Leave, Visitors, Maintenance, Inventory,
Announcements, Events, Staff, Feedback, Documents, Search, Emergency) adds its
own 1-2 entities following the same pattern (scoped to a Property, usually
linked to a StudentProfile) — see `backend/prisma/schema.prisma` for the full model list.

### Key enums

`Role` · `PropertyType` / `PropertyStatus` · `RoomType` / `RoomStatus` ·
`BedStatus` · `StudentStatus` · `Gender` · `StaffRole` / `StaffStatus` / `Shift` ·
`PaymentMethod` / `PaymentStatus` · `InvitationStatus`. (Exact values live in the
schema.)

## Money: charge vs payment

- A **RentCharge** is *what is owed* (the bill for a period).
- A **Payment** is *what was received*. It settles one or more charges.
- **Online payment is only "paid" when the signed Razorpay webhook confirms it**
  — never on the client's say-so. Staff can also **record** an offline payment
  (cash/UPI) directly.

## API surface (v1)

Base URL: `/api/v1`. All 22 modules are live — nothing in the real app shows
*unavailable* anymore (see [03-roadmap.md](03-roadmap.md)).

| Area | Representative endpoints |
| --- | --- |
| **Auth** | `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`, `GET /auth/me`, `GET /auth/session`, `POST /auth/invitations/accept`, `GET /auth/invitations/:token` |
| **Properties** | `GET /properties`, `GET /properties/:id`, `POST /properties`, `PATCH /properties/:id`, `PATCH /properties/:id/status` |
| **Rooms & Beds** | `GET /rooms`, `POST /rooms`, `PATCH /rooms/:id`, `POST /beds/assign`, `POST /beds/vacate`, `PATCH /beds/:bedId/status` |
| **Students** | `GET /students`, `GET /students/:id`, `POST /students`, `PATCH /students/:id`, `PATCH /profile` / `/self` |
| **Payments & Charges** | `GET /charges`, `GET /payments`, `GET /payments/summary`, `GET /payments/:paymentId/receipt`, `POST /payments/pay-now`, `POST /payments/verify`, `POST /payments/record`, `POST /payments/reminders`, `POST /payments/:paymentId/refund`, `POST /payments/webhook` |
| **Complaints, Leave, Visitors, Maintenance, Inventory, Announcements, Events, Staff, Feedback, Documents, Search, Emergency** | Each follows the same shape: list/get/create + role-appropriate update actions. See `backend/src/modules/<name>/` and `BACKEND_HANDOFF.md` for the full list. |
| **Settings** | Org settings, plans. |
| **Uploads** | Presigned upload/download (local dev or Cloudflare R2). |
| **Misc** | `GET /activity`, `GET /notifications`, `PATCH /notifications/:id`, `PATCH /notifications/read-all`, `GET /next-code` |

> This table is a map, not a contract. For exact request/response shapes read the
> module's `*.validation.js` (Zod) and `*.controller.js`, or `BACKEND_HANDOFF.md`.

## Security that's already wired in

From `backend/README.md`: bcrypt password hashing · refresh tokens stored hashed +
rotated + revocable · role/property/student scope enforced **server-side from the
token** · Prisma parameterized queries · Helmet · CORS allowlist · rate limiting ·
central error handler (no stack traces in prod) · transactional bed assignment and
payment posting · gateway webhooks verified and idempotent.

_Last reviewed: 2026-11-08_
