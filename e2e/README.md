# E2E, accessibility, visual and performance suites

All suites run against a **local** stack only: an in-memory MongoDB backend with the demo seed and a
Vite dev server pointed at it. Never point them at production (`backend/.env` / `frontend/.env`).

```bash
# backend (in-memory DB + demo seed)        — from backend/
PORT=3310 AUTH_PHONE_OTP_ONLY=false REDIS_URL= EMAIL_NOTIFICATIONS=false DISABLE_RATE_LIMIT=true npm run dev:mem
# frontend                                    — from frontend/
VITE_API_URL=http://localhost:3310/api/v1 npx vite --port 5310 --strictPort

# run a suite                                 — from frontend/
PLAYWRIGHT_BASE_URL=http://localhost:5310 E2E_API_URL=http://localhost:3310/api/v1 npx playwright test e2e/<file> --workers=1
```

| Spec | What it checks | Dataset |
| --- | --- | --- |
| `*-flow.spec.ts`, `shell.spec.ts`, … | business flows role by role | demo seed |
| `a11y.spec.ts` | axe-core WCAG 2.1 A/AA on every sidebar route for admin, designer, store keeper, operator; drawer, search-select, row menu, confirm dialog, modal, command palette, account menu, mobile nav (375 px); keyboard-only walkthrough | demo seed |
| `visual.spec.ts` | `toHaveScreenshot()` baselines, desktop 1440×900 and mobile 375×812 | **fresh** demo seed |
| `perf.spec.ts` | API median < 1 s, page → data visible < 3 s | **large** dataset (`SEED_LARGE=true`) |

## Accessibility (`a11y.spec.ts`)

Fails on any **serious** or **critical** axe violation. Documented exceptions live in the `ALLOWED`
list at the top of the spec — every entry needs a justification; prefer fixing the shared component
in `src/components/erp`. A JSON report of all findings (every impact level) is written to
`test-results/a11y/` (override with `A11Y_REPORT_DIR`).

## Visual regression (`visual.spec.ts`)

Determinism: time frozen with `page.clock.setFixedTime`, `reducedMotion: 'reduce'`, animations
disabled, caret hidden, fixed locale/timezone, waits for network idle + web fonts + no skeletons, and
masks for volatile regions (anything date/time-like, KPI values, badges/counts, avatar, toasts, chat
button, charts).

**Update baselines** after an intended UI change (restart the backend first so the seed is fresh):

```bash
PLAYWRIGHT_BASE_URL=http://localhost:5310 E2E_API_URL=http://localhost:3310/api/v1 \
  npx playwright test e2e/visual.spec.ts --workers=1 --update-snapshots
# only some pages:   … e2e/visual.spec.ts -g "dashboard|purchase" --update-snapshots
```

Then run the spec twice without `--update-snapshots` to confirm the new baselines are stable, review
the PNG diffs in `e2e/visual.spec.ts-snapshots/` and commit them.

**Baselines are OS-specific.** Font rasterisation differs between Windows, macOS and Linux, so the
committed files are named `*-chromium-win32.png` (generated on Windows). A Linux CI runner looks for
`*-chromium-linux.png` and needs its own baselines: generate them once on the CI image (or in the
`mcr.microsoft.com/playwright` Docker image matching the installed Playwright version) with
`--update-snapshots` and commit them alongside the Windows ones.

## Performance (`perf.spec.ts`)

Start the backend with the large dataset layered on the demo seed (≈2k materials, 200 suppliers,
3k designs, 5k SKUs, 600 BOMs, 3k PR/PO/GRN, 2k production orders + batches, 13k inventory rows,
5k notifications, 3k approvals, 5k audit logs):

```bash
SEED_LARGE=true PORT=3310 AUTH_PHONE_OTP_ONLY=false REDIS_URL= EMAIL_NOTIFICATIONS=false DISABLE_RATE_LIMIT=true npm run dev:mem
```

`npm run seed:large -- --uri=mongodb://127.0.0.1:<port>/<db>` adds the same data to an explicitly
given **local** database; the script refuses anything that is not localhost / 127.0.0.1 / ::1 and
never reads `.env`.

The spec logs a timing table and writes `test-results/perf/{api,pages}.json` (override with
`PERF_REPORT_DIR`). Page timings include the dev server serving unbundled modules, after one warm-up
pass.
