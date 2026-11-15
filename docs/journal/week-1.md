# Week 1 learning log — November 9–15, 2026

## Plan and actual time
Record actual dates and hours; do not claim unperformed work.

| Date | Minutes | Work completed | AI assistance | Verification / blockers |
|---|---:|---|---|---|
| Nov 12 | TBD | Draft scope, architecture, roadmap; decide hybrid recipe model | ChatGPT planning + scaffold | Run tests locally and record actual results |
| Nov 13 | | | | |
| Nov 14 | TBD (owner to record) | Repository review; finalized scope v2 (five product areas); docs updated (README, CLAUDE.md, scope, architecture, new DATA_MODELS.md, roadmap, backlog, ADR-007–015) | Claude Code: repo review and documentation update; no application code changed | Claude Code ran backend tests (5 passed, 1 deprecation warning) and frontend type-check + build (success). Owner has not yet run the UI in a browser or captured screenshots. Git repo not initialized. |
| Nov 15 | | | | |

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
