# QA scripts (optional)

> These scripts drive the old **mock-mode** app (demo personas, `meraki-demo-v1` storage). The current app is API-only, so they only run against the archived mock build: `git worktree add ../meraki-mock archive/frontend-mock`, then build and run them there. See the step mapping in the B-phase report for what replaces each step.

Browser checks used to verify the build. They need Python 3.10+ and `pip install playwright && playwright install chromium`.

```bash
npm run build
npx vite preview --port 4173 --strictPort &   # leave running
python3 qa/smoke.py    # every route, per role; prints URL, h1 and any console errors
python3 qa/flows.py    # 35-step cross-role workflow (PASS lines)
python3 qa/resp.py     # horizontal-overflow scan at 360/768/1024/1440px
python3 qa/kbd.py      # keyboard/focus checks
```
Set `CHROMIUM_PATH` to use a specific Chromium binary. Each script starts from a fresh browser context, so the demo data is the original seed.
