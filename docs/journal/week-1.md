# Week 1 learning log — November 9–15, 2026

## Plan and actual time
Record actual dates and hours; do not claim unperformed work.

| Date | Minutes | Work completed | AI assistance | Verification / blockers |
|---|---:|---|---|---|
| Nov 12 | TBD | Draft scope, architecture, roadmap; decide hybrid recipe model | ChatGPT planning + scaffold | Run tests locally and record actual results |
| Nov 13 | | | | |
| Nov 14 | TBD (owner to record) | Repository review; finalized scope v2 (five product areas); docs updated (README, CLAUDE.md, scope, architecture, new DATA_MODELS.md, roadmap, backlog, ADR-007–015) | Claude Code: repo review and documentation update; no application code changed | Claude Code ran backend tests (5 passed, 1 deprecation warning) and frontend type-check + build (success). Owner has not yet run the UI in a browser or captured screenshots. Git repo not initialized. |
| Nov 14 (later) | TBD (owner to record) | Phase 2 backend (owner-approved): structured sample recipes; Pydantic models for quantities, recipes, inventory records, matching, deduction previews; same-dimension unit conversion; quantity-aware matching with shortages and opt-in staple assumption; stateless deduction preview; `GET /api/ingredients`, `POST /api/recipes/match`, `POST /api/deductions/preview`; ADR-016–020. No frontend changes | Claude Code implemented code, tests, and doc updates | Claude Code ran `python -m pytest -q` → 86 passed, 1 deprecation warning; `npm run build` → success. Sample recipe quantities are AI-drafted and need owner review. New endpoints are not used by the UI yet |
| Nov 14 (later) | TBD (owner to record) | Phase 3 part 1 (owner-approved): touchscreen frontend redesign — Home, simulated Scan with amount entry, My Kitchen (demo inventory in versioned localStorage, add/edit/remove, low-stock), Recipes (backend matching, servings/time/staples filters), full recipe view, guided cooking; device-preview bezel and `?mode=kiosk`. Backend: `GET /api/recipes/{id}/full`, `GET /api/units`, `POST /api/inventory/stock-status`; ADR-021–024 | Claude Code implemented code, tests, docs; ran a scripted headless-Chrome walkthrough | `python -m pytest -q` → 91 passed, 1 deprecation warning; `npm run build` → success; headless walkthrough 36/36 checks, no console errors (screenshots in `docs/screenshots/`). Not yet used by hand on a touchscreen; grocery and deduction apply/undo not started |
| Nov 15 | TBD (owner to record) | Phase 3 part 2 (owner-approved): Grocery List screen (manual + recipe items, purchased, compatible-only merges, confirmed move to My Kitchen); deduction review after cooking with confirm and undo (persists across refresh); Reset demo data; storage v2 with v1 migration. Backend: `POST /api/deductions/apply`, `/api/deductions/undo`, `/api/quantities/combine`; ADR-025–027; repeatable `npm run walkthrough`. Sample-recipe inconsistencies flagged in BACKLOG for owner review | Claude Code implemented code, tests, docs; ran the browser walkthrough | `python -m pytest -q` → 108 passed, 1 deprecation warning; `npm run build` → success; walkthrough 29 checks + layout checks passed, no console errors. Not yet used by hand on a touchscreen |

## Corrections and status notes (added Nov 14)
Historical rows above are preserved as written. Clarifications:
- The roadmap planned "initialize repository" for Nov 13. As of Nov 14 the project folder is **not** a Git repository and has no GitHub URL.
- The Nov 12 row asks to "run tests locally and record actual results". First recorded run: Nov 14, by Claude Code on the owner's Mac — `python -m pytest -q` → 5 passed; `vite build` → success. Bare `pytest` fails to import `app` (known issue).
- The scaffold demo covers scanning (simulated), recipe matching, and step-by-step cooking only. Inventory and grocery screens do not exist yet.

## Scope change log
- **Nov 12 — v1:** scanning, recipe discovery, guided cooking; inventory listed as P2 stretch; no grocery list.
- **Nov 14 — v2:** five product areas (scanning, discovery, viewing & cooking, inventory, grocery list). Inventory quantities, deductions with undo, low stock, and grocery list are P1. Decisions recorded as ADR-007 to ADR-015 in `docs/DECISIONS.md`; backlog renumbered (old → new map in `docs/BACKLOG.md`).

## Reflection prompts
- What led me to choose a kitchen hub over earlier project concepts?
- What did I learn about linking hardware, recipe providers and AI?
- Where did I constrain the scope, and why?
- How did I verify AI-generated architecture or code?
- What is my most important Week 2 risk?

## Evidence to capture
- Repository URL
- README/CLAUDE.md and docs commit
- Terminal output of actual passing tests and build
- Screenshot of demo mode, selected recipe and cooking steps
- Portfolio Artifact 5 card URL
