# StayPookie — Product Specification

> **About this document.** The original `spec.md` is not present anywhere in
> this repository's history, but several GitHub issues quote specific parts of
> it by number (`Spec section 6.3`, `Spec section 11`, `spec workflow 5`
> through `spec workflow 10`). This version reconstructs the document: every
> numbered section or workflow called out below that an issue already cites is
> written to match that citation exactly (quoted inline where it's used). The
> surrounding structure and numbering is freshly authored to make those
> citations sit in a coherent whole, not a recovered original — treat section
> numbers that no issue cites as new, not restored. It also now reflects the
> product as it actually is (a real backend + frontend), not the mock-only
> prototype the original spec was written against (see §1).

## 1. What StayPookie is

StayPookie is hostel-management software for Indian student hostels (PGs), used
by three kinds of people:

- **Owner** — runs one or more properties (hostels) under one organization.
- **Manager / warden** — runs the day-to-day operation of one property.
  Accountants have the same account type with a different job title.
- **Student** — a resident of one property.

The product was first validated as a frontend-only, mock-data prototype (see
`prototype/`) before any backend existed. That prototype is kept only for
product demos and scope validation; the current product is the real backend
(`backend/`) and frontend (`staypookie-frontend/`) described in this document and
in `BACKEND_HANDOFF.md`.

## 2. Roles & access

Three account roles: `owner`, `manager`, `student` (see `Role` in
`staypookie-frontend/src/types/domain.ts`).

- An **owner** sees every property in their organization.
- A **manager** sees only their own property.
- A **student** sees only their own record.

Another organization's or another property's record is reported as not found,
not as forbidden — scope never reveals whether a record exists outside the
caller's reach.

## 3. Properties, rooms and beds

A property has rooms; a room has beds (single/double/triple/quad, one to four
beds). A bed is available, occupied, or unavailable (blocked, e.g. for
repair). A resident occupies at most one bed. Assigning a resident to a new
bed while they already hold one is a transfer: the old bed is freed in the
same operation. A bed cannot be blocked while occupied; vacate the resident
first.

## 4. Residents (students)

### 4.1 Admission

A resident is admitted to a property, optionally straight onto a bed (active)
or onto a waiting list (pending, no bed yet). Admission can raise a refundable
security deposit and can send a sign-in invitation (§7).

### 4.2 Profile and status

A resident's status is `pending` (waiting for a bed), `active`, `notice`
(leaving soon) or `moved_out`. Moving out releases their bed. **Moving out a
resident who still owes rent needs the owner's explicit confirmation** — a
manager cannot move out a resident with an unpaid balance; an owner can
override it.

### 4.3 One mobile number per resident

> **Spec section 6.3:** a mobile number belongs to one current resident.

A phone number may belong to only one active (non-moved-out) resident per
organization at a time. The check compares normalized digits, so formatting
differences (`98765 43210` vs. `+91 98765 43210`) don't let a duplicate
through. A moved-out resident's number is free again for someone else to use.

## 5. Billing and payments

Rent is raised automatically on the 1st of the month (the first month is
pro-rated from the joining day), due on a configurable day (default the 5th).
An optional flat late fee applies after a grace period (off by default).
Deposits and one-off charges can be raised and later adjusted, with a reason
recorded. Payments are recorded by staff (cash, UPI, bank transfer, card) or
paid online by the student through Razorpay; either way, a payment is never
counted until it's independently confirmed (by Razorpay for online payments),
never on the client's word alone. Refunds (owner only) can also lower the
original charge, e.g. returning a deposit at move-out.

## 6. Staff

A property's staff have a job title (`manager`, `warden`, `accountant`,
`housekeeping`, `security`, `cook`, `maintenance`), but only `manager`,
`warden` and `accountant` are ever eligible for an app sign-in or for being
set as a property's manager of record. Owners add staff to any property in
their organization; managers add staff only to their own property.

## 7. Accounts and invitations

A resident or eligible staff member can be sent an invitation (by email, or
handed to them as a link where email isn't configured) to create their own
sign-in. Accepting an invitation needs the underlying resident/staff record to
still be active and not already have an account. Password reset works the
same way for every role and never reveals whether an account exists for a
given email or phone.

## 8. Requests and operations

### 8.1 Complaints

> **Spec workflow 5:** a student submits a complaint; the manager sees it in
> their queue; the owner sees it portfolio-wide.

Every status change is recorded in a visible history. Internal staff notes on
a complaint are never shown to the student who filed it.

### 8.2 Leave

> **Spec workflow 6:** the student is notified of the manager's decision.

A leave request has a return date on or after its departure date. Only a
pending request can be approved, rejected or cancelled.

### 8.3 Visitors

> **Spec workflow 7:** the visit history is visible to both the student and
> the manager.

A visitor request is approved before check-in, and checked in before
check-out. A walk-in is logged directly against today, regardless of what
date is submitted for it.

### 8.4 Maintenance

A maintenance ticket follows a fixed status lifecycle; a cost can never be
negative.

### 8.5 Inventory

> **Spec workflow 8:** a stock adjustment that would take quantity below zero
> is rejected, not silently clamped to zero.

Every stock adjustment and its resulting transaction row are written
together, so the two can never disagree.

### 8.6 Notices (announcements)

> **Spec workflow 9:** a student sees only published notices actually
> targeted at them (the whole hostel, their floor, or their room); read state
> is tracked per student.

### 8.7 Events, feedback, documents

Events have a status lifecycle (scheduled/completed/cancelled) and an end
time after their start time. Feedback can be submitted anonymously, and stays
anonymous even to staff when it is. Documents are stored as the actual
uploaded file (not just a filename and size) in private storage, with a
review workflow (verified/rejected, with a note).

### 8.8 Emergency

A student's emergency page shows their hostel's address and contacts, their
own emergency contact details, and a "report emergency" action. Reporting an
emergency is real, not a mock confirmation: it notifies the property's
managers and the organization's owners immediately, with the student's room.
It never implies that police or an ambulance have been contacted — the page
tells the student to call emergency services themselves first.

## 9. Activity log

> **Spec workflow 10:** every change of consequence — not just payments —
> leaves a visible trail.

Creating or updating a property, creating or updating a room, changing a
bed's status, assigning/transferring/vacating a bed, and creating or updating
a resident (including status changes) all write an activity log entry, in the
same database transaction as the change itself. Assigning, transferring or
vacating a resident's bed also notifies that resident.

## 10. Search

Staff and students can search across the records they're allowed to see
(residents, rooms, properties, payments by receipt number, staff, complaints,
notices, and app pages) with a minimum 2-character query, each result scoped
to the searcher's role and organization/property.

## 11. Documentation and handoff

> **Spec section 11:** requires `BACKEND_HANDOFF.md` — endpoints,
> request/response types, roles and error codes, plus a short database-safety
> section (never run destructive/seed commands against a shared or production
> database).

See `BACKEND_HANDOFF.md` at the repository root.

## 12. MVP scope

Every module below already has a working backend and frontend as of this
writing (verified against the code, not assumed):

| Module | Status |
| --- | --- |
| Accounts, invitations, password reset | Done |
| Properties, rooms, beds | Done |
| Residents (admission, profile, status, one mobile number per resident) | Done |
| Billing, payments, Razorpay checkout, refunds | Done |
| Staff | Done |
| Complaints, leave, visitors | Done |
| Maintenance, inventory | Done |
| Notices, events | Done |
| Feedback, documents | Done |
| Emergency alerts | Done |
| Settings and plans | Done |
| Analytics (overview, trends, comparison) | Done |
| Activity log (property/room/bed/student changes) | Done |
| Global search | Done |

**Explicitly out of scope for now** (carried from `BACKEND_HANDOFF.md`'s "Not
included yet"): two-step sign-in (OTP) enforcement, SMS notifications, billing
hostel owners for their plan, and GST tax invoices.

Every module above is merged to `main` and deployable. The open question for
whoever owns product scope is no longer "what's MVP" but "what's next" — see
`docs/03-roadmap.md` for the four planned features beyond this scope
(postpaid rent, printable biodata, automated backup, hostel landing pages)
and `docs/09-launch-checklist.md` for what's left before go-live.
