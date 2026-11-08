# 08 — Data Model & API Reference

The shared glossary and API map. _Source of truth:
`backend/prisma/schema.prisma`, `backend/src/modules/*`._

## Entities

```
Organization  (hostel business / tenant boundary)
 ├─ User            (Owner / Manager / Warden / Student)
 │   └─ RefreshToken (hashed, rotated, revocable)
 ├─ Invitation      (token + status)
 └─ Property
     ├─ Room (RoomType, RoomStatus)
     │   └─ Bed (BedStatus) — the unit a student is assigned to
     ├─ StudentProfile (linked to a User + a Bed)
     ├─ StaffMember (StaffRole, Shift, StaffStatus)
     └─ RentCharge → Payment (PaymentStatus/Method)

Cross-cutting: Counter (number sequences) · Notification · ActivityLog
```

| Entity | Meaning |
| --- | --- |
| **Organization** | One hostel business — the tenant boundary; every record belongs to one org. |
| **User** | Anyone who logs in; `Role` decides access. |
| **Property / Room / Bed** | Building → room → the assignable unit students occupy. |
| **StudentProfile** | A resident, tied to a `User` and a `Bed`. |
| **StaffMember** | A non-student worker. |
| **RentCharge** | What a student owes for a period — the bill. |
| **Payment** | Money received, reconciled against charges. Online payment is **confirmed only by the Razorpay webhook**, never the client. |
| **Notification / ActivityLog** | Per-user alerts; audit trail for the activity feed. |

The 12 daily-ops modules (Complaints, Leave, Visitors, Maintenance,
Inventory, Announcements, Events, Staff, Feedback, Documents, Search,
Emergency) each add 1-2 entities following the same pattern — full list in
`schema.prisma`.

## API surface (v1)

Base `/api/v1`. All 22 modules are live.

| Area | Representative endpoints |
| --- | --- |
| Auth | `/auth/login`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`, `/me`, `/invitations/accept` |
| Properties / Rooms / Beds | `/properties`, `/rooms`, `/beds/assign`, `/beds/vacate` |
| Students | `/students`, `/students/:id`, `/profile` / `/self` |
| Payments | `/charges`, `/payments`, `/payments/pay-now`, `/verify`, `/record`, `/refund`, `/webhook` |
| Daily ops | Complaints / Leave / Visitors / Maintenance / Inventory / Announcements / Events / Staff / Feedback / Documents / Search / Emergency — list/get/create + role-appropriate updates. See `backend/src/modules/<name>/`. |
| Settings / Uploads / Misc | Org settings & plans · presigned uploads (local / Cloudflare R2) · `/activity`, `/notifications` |

> Map, not a contract — exact shapes are in each module's
> `*.validation.js`/`*.controller.js`, or `BACKEND_HANDOFF.md`.

## Security already wired in

bcrypt hashing · refresh tokens hashed/rotated/revocable · role/property/
student scope enforced **server-side from the token** · parameterized
queries (Prisma) · Helmet · CORS allowlist · rate limiting · no stack traces
in prod · transactional bed assignment + payment posting · webhooks verified
and idempotent.

_Last reviewed: 2026-11-08_
