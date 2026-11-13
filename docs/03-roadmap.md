# 03 — Roadmap & Module Status

Every module has a real backend — PR #35 landed all of it in one go. What's
left before launch is deploy + verify, not building — see
[09-launch-checklist.md](09-launch-checklist.md).

_Source of truth: `staypookie-frontend/src/lib/features.ts` (`AVAILABLE`)._

## ✅ Live (nothing shows "unavailable")

| Module | Notes |
| --- | --- |
| Auth | Login, roles, refresh tokens, invitations, password reset. |
| Properties / Rooms / Beds | Transactional bed assignment. |
| Students | Records, bed assignment, biodata. |
| Payments | Razorpay Checkout + webhook, refunds, receipts — paid state confirmed server-side only. |
| Complaints / Leave / Visitors | Request → resolve flows with role rules. |
| Maintenance / Inventory | Tickets with cost tracking; items + transactions. |
| Announcements / Events | Owner→residents broadcast; capacity-limited events. |
| Staff / Feedback | Worker directory; resident feedback + rating. |
| Documents / Uploads | Student document records; file storage (local dev / Cloudflare R2). |
| Settings / Search / Emergency | Org settings & plans; cross-entity search; emergency alerts. |
| Notifications, Activity, Analytics | Cross-cutting — feed, audit trail, dashboards. |

## Adding a new module

1. Prisma model(s) → 2. `*.validation.js` → 3. `*.service.js` (scope checks +
`$transaction`) → 4. `*.controller.js` → 5. `*.module.js` (auto-mounted by
`src/routes/modules.js`) → 6. frontend `http` adapter, flip `unavailable` →
`http` in `services/index.ts`, add to `AVAILABLE`.

Not done until step 6, clicked through in the real app.

## Mobile app

One Expo app for all three roles — plan, scope and milestones (M0–M5) in
[10-mobile-app.md](10-mobile-app.md). Built (all roles, push backend done);
next is testing on real phones and the store release.

## Planned features (post-launch, roughly in this order)

- **PF-1 — Postpaid rent:** a grace period (5 days) where a manager can let a
  student stay with rent outstanding, tracked instead of lost in a notebook.
  Hooks into `RentCharge`/`Payment`. [review] auto vs manager-granted, limits.
- **PF-2 — Printable student biodata:** one-page print/PDF view generated
  from `StudentProfile`. [review] fields, photo, PDF vs browser print.
- **PF-3 — Daily Google-Drive backup:** a scheduled job exporting essential
  data to Drive sheets/folders for business continuity. [review] which
  tables, retention, Drive ownership — decide alongside credentials/export in
  [06-decisions.md](06-decisions.md).
- **PF-4 — Hostel landing-page builder** _(build last)_: plan-gated
  templates, public page at `staypookie.com/hostel/<name>`. [review] plan
  tier, custom domains, template editability.

_Last reviewed: 2026-11-13_
