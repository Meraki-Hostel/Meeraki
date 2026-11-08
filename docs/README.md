# StayPookie — Project Documentation

This folder is the **planning brain** of the project. Code tells you *how*
things work right now; these docs tell you *what* we are building, *why*, and
*what is left to do* — so work stays aligned and nothing gets messed up.

> Keep these docs honest. If a doc and the code disagree, fix one of them in the
> same change. A stale plan is worse than no plan.

## What's in here

| File | Read it when you want to know… |
| --- | --- |
| [01-vision.md](01-vision.md) | What StayPookie is, who it's for, and what "done" means. The target. |
| [02-architecture.md](02-architecture.md) | The three apps, how they fit together, and the rules that keep them separate. |
| [03-roadmap.md](03-roadmap.md) | What's live (everything) and the planned features still ahead. |
| [04-conventions.md](04-conventions.md) | The working rules. Read before you change code. |
| [05-todo.md](05-todo.md) | The running task board — what's in flight right now. |
| [06-decisions.md](06-decisions.md) | Why we chose things, so we don't re-argue settled questions. |
| [07-getting-started.md](07-getting-started.md) | How to run the app locally (verified steps + gotchas). |
| [08-data-model.md](08-data-model.md) | The entities, the shared glossary, and the API surface. |
| [09-launch-checklist.md](09-launch-checklist.md) | Go-live checklist and dates — what's left before users can log in. |

Two companion documents live at the **repo root**, not here, because they're
read by people outside this planning context too:

| File | Read it when you want to know… |
| --- | --- |
| [`../spec.md`](../spec.md) | The full product spec — every rule, module by module. The detail behind [03-roadmap.md](03-roadmap.md). |
| [`../BACKEND_HANDOFF.md`](../BACKEND_HANDOFF.md) | The API contract for anyone integrating with or picking up backend work: every endpoint, response envelope, error codes, database-safety rules. |

## How to use this folder

- **Starting a new piece of work?** Check [05-todo.md](05-todo.md) and
  [03-roadmap.md](03-roadmap.md) first, then read [04-conventions.md](04-conventions.md).
- **Finished something?** Tick it off in the roadmap/todo in the same PR.
- **Made a non-obvious choice?** Add one line to [06-decisions.md](06-decisions.md).
- **Changed what we're aiming for?** Update [01-vision.md](01-vision.md) so the
  target stays true.

_Last reviewed: 2026-11-08_
