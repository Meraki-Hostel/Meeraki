# 05 — To-Do Board

The running list of what's actually in flight. Keep it short — this is "now and
next", not a dumping ground. The full module list lives in
[03-roadmap.md](03-roadmap.md).

> Rule: **finish what's in "In progress" before pulling from "Next".** One module
> at a time keeps the system from getting messed up.

## 🔨 In progress

| Task | Who | Notes |
| --- | --- | --- |
| _(nothing yet — move one item from Next here when you start it)_ | | |

## ⏭️ Next (pick from here)

| Task | Why |
| --- | --- |
| **LAUNCH (11 Nov 1 PM) — work the checklist** | [09-launch-checklist.md](09-launch-checklist.md). Deploy + wire + verify — every module is already built. Team cutoff 10 Nov 11:59 PM. |
| **Confirm the payments decision** (D-0005) | Real Razorpay or offline recording for launch? Only Pawan can decide. |
| **Review the completed docs** and confirm the `[review]` lines in [01-vision.md](01-vision.md) | The target drives everything else. |
| Decide **D-0003**: a separate dev database | So pre-launch testing doesn't write to the live Neon data. |

## 💡 Backlog / ideas (unordered)

- **Planned features** PF-1…PF-4 (postpaid rent, printable biodata, Google-Drive
  backup, landing-page builder) — specced in [03-roadmap.md](03-roadmap.md). These
  are genuinely not built yet; pick them up after launch. PF-4 is last.
- Add a real `/health` route on the API (handy for uptime checks; currently 404s).
- Document the deploy steps (Netlify frontend + Node host backend) in `02-architecture.md`.
- Student-facing mobile web polish once core modules are live.

## ✅ Recently done

| Date | What |
| --- | --- |
| 2026-11-08 | All 22 backend modules merged to `main` (PR #35, #38) — the module build-out this roadmap tracked is done. |
| 2026-11-08 | Completed the docs: filled vision/roadmap, added getting-started + data-model. |
| 2026-11-07 | Renamed Meraki → StayPookie across the codebase (PR #39/#40). |
| 2026-11-07 | Created the `docs/` planning folder. |

_Last reviewed: 2026-11-08_
