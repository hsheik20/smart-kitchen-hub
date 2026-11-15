# Claude Code working instructions

You are assisting a solo TCSS 490 student on a five-week Moonshot (Nov 9 – Dec 13, 2026). Your job is to implement scoped backlog issues while preserving a demonstrable, testable application.

Product: a Raspberry Pi cooking assistant with five areas — ingredient scanning, recipe discovery, recipe viewing & guided cooking, kitchen inventory, and grocery list. See `docs/PROJECT_SCOPE.md` for priorities (P0/P1/P2).

## Ground rules
1. Before editing, read `README.md`, `docs/PROJECT_SCOPE.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODELS.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, and the active backlog item in `docs/BACKLOG.md`.
2. Propose a short plan; implement **one small vertical slice at a time**. Do not expand scope (or pull P1/P2 work forward) without owner approval.
3. Keep device, backend, provider adapters, and frontend separated. Do not import Raspberry Pi-only packages (e.g. Picamera2) into cross-platform code or tests.
4. Define and validate Pydantic schemas at API boundaries, following `docs/DATA_MODELS.md`. Keep ingredient matching, unit handling, and inventory deductions deterministic and unit-tested. AI is an optional interpreter, never the sole source of ingredient availability or quantities.
5. Label every simulated or demo implementation as such in the UI and docs (scanning, inventory, grocery, or anything else). Never imply camera vision, ratings, inventory, sync, or provider integrations work until implemented and tested.
6. Quantities: store availability separately from quantity; quantities carry `accuracy` (exact / estimated / unknown). Never invent or default an unknown quantity, never convert between incompatible units (no mass↔volume density guesses), and never change inventory without explicit user confirmation. Deductions must be undoable.
7. Grocery-list items are not inventory. Marking an item purchased does not add it to inventory unless the user confirms that separately.
8. Recipe sources: prefer providers with documented acceptable use. Never bypass access controls, robots directives, or paywalls. Do not copy or redistribute full recipe steps without authorization. Preserve provenance and attribution; ratings and review counts only from the provider, otherwise `null`. Never fabricate reviews, nutrition, quantities, cook times, or source permissions.
9. Credentials only via environment variables; `.env` is ignored. No secrets in commits, responses, logs, or browser bundles.
10. Privacy: do not store raw food photos by default; validate type and size of uploads; no user-controlled file paths. Any multi-device/phone access requires authentication first.
11. After changes run `cd backend && python -m pytest -q` (use `python -m`; bare `pytest` fails to import `app`) and `cd frontend && npm run build`.
12. Update the current weekly log (`docs/journal/week-N.md`), `docs/DECISIONS.md` for architecture changes (append new ADRs; do not rewrite old ones), and backlog status/acceptance criteria.
13. Report accurately: files changed, commands run, test results, open risks, next steps. No invented completion or tool output.

## Definition of done
- Feature runs through a documented user journey
- Schema and error conditions tested where applicable (including unknown quantities and unit mismatches for inventory work)
- No secrets, copyrighted instruction misuse, or fabricated ratings/quantities
- Simulated parts labelled in UI and README feature-status table
- Documentation reflects actual state
- Demonstrable on a Mac without physical hardware when hardware is unavailable

## Issue workflow
Select one item from `docs/BACKLOG.md` → clarify inputs/outputs → implement → test → update docs/log → commit (once the Git repository exists; do not initialize Git or push without owner approval).
