# Smart Kitchen Hub — TCSS 490 Artifact 5 (Moonshot)

**Project:** A Raspberry Pi–powered cooking assistant that combines camera-based ingredient recognition, recipe discovery, guided cooking, kitchen inventory, and grocery planning.

**Current state (Nov 15, 2026):** Touchscreen-first React UI covering all five areas: home, simulated scan, My Kitchen, recipe discovery, full recipe view, guided cooking, deduction review with undo, and a grocery list. Ingredient scanning is **simulated** (the user picks every item; no camera or AI). Inventory and groceries are **demo data stored only in the browser** (localStorage); there is no server-side persistence yet. Recipes are original sample data.

## Product areas
1. **Ingredient scanning** — Pi camera capture, AI recognition (Week 2), user confirms/corrects results, then optionally enters an exact quantity, an estimate, or skips quantity.
2. **Recipe discovery** — curated original recipes first, then a supported external provider; later, *permitted* creator-site imports. Ranked by available/missing ingredients, time, servings, and preferences, with source attribution and only provider-verified ratings.
3. **Recipe viewing & cooking** — full recipe view (ingredients, quantities, directions, notes, substitutions, safety cautions) and a separate step-by-step cooking mode, both rendered from the same structured recipe record. Timers are an enhancement.
4. **Kitchen inventory** — confirmed ingredients saved with exact/estimated/unknown quantities and units; recipe-completion deductions proposed, confirmed, and undoable; low-stock indicators.
5. **Grocery list** — missing recipe ingredients and manual items, purchased status, optional quantities; kept separate from owned inventory. Phone access later.

Priorities: **P0** end-to-end scan → confirm → match → full recipe view → guided cooking (simulated scan allowed before hardware). **P1** grocery list, quantity-aware inventory, deductions with undo, low-stock, better filtering. **P2** voice, personalization, multi-provider discovery, advanced substitutions, sensors, multi-device sync. Full detail: [docs/PROJECT_SCOPE.md](docs/PROJECT_SCOPE.md).

## Feature status
**Implemented** = working code with tests. **Simulated** = works, but stands in for a real capability and is labelled as demo in the UI. **Partial** = some acceptance criteria met. **Planned** = no code yet.

| Area | Capability | Status | Notes |
|---|---|---|---|
| Scanning | Ingredient "scan" | Simulated | Scan screen: pick from the catalog (`GET /api/ingredients`), type free-text items, or load a fixed "sample suggestions" list. Banner: SIMULATED SCAN — no camera or AI |
| Scanning | Verify + quantity entry | Implemented (UI) | Per item: exact / estimate / unknown, amount + unit; unknown is saved as `null`, never 0; explicit "Save to My Kitchen" |
| Scanning | Pi camera capture, AI recognition | Planned | Week 2; hardware not yet purchased |
| Discovery | Curated demo recipes | Implemented (sample data) | 4 **original sample recipes** in `backend/app/data.py` with structured quantities, notes, substitutions, safety cautions, provenance; quantities are illustrative, not kitchen-tested; labelled "Sample recipe" in the UI |
| Discovery | Quantity-aware matching | Implemented | UI calls `POST /api/recipes/match` with the demo inventory: match %, missing, not enough, not checked, assumed staples, ranking reasons |
| Discovery | Filters: servings, time, pantry staples | Implemented | Servings scale amounts (backend); time limit chips; opt-in "assume pantry staples" toggle |
| Discovery | Ingredient catalog | Implemented | `GET /api/ingredients`; 10 ingredients with aliases and staple flags |
| Discovery | Preferences, external provider, ratings | Planned | Sample recipes have no ratings; UI says "No ratings" |
| Viewing & cooking | Full recipe view | Implemented | `GET /api/recipes/{id}/full`: amounts (scaled when servings differ), preparation, substitutions, directions, step safety notes, food-safety cautions, notes, source/licence note, per-ingredient kitchen status |
| Viewing & cooking | Guided cooking | Implemented | One step at a time, large Previous/Next, tappable progress bar, step ingredients with amounts, safety notes, arrow keys; links to/from the full recipe; "Continue cooking" on Home |
| Viewing & cooking | Timers | Planned | Enhancement (P1) |
| Inventory | My Kitchen (demo) | Simulated storage | Add / edit / remove items, availability, exact/estimated/unknown amounts. Stored only in this browser (versioned localStorage, `skh.state` v1); labelled "Demo inventory" |
| Inventory | Low-stock indicators | Implemented (demo) | User-set threshold; status computed by `POST /api/inventory/stock-status`; shown only when amount and threshold are known and comparable |
| Inventory | Deductions after cooking | Implemented (demo) | “Review inventory usage” after guided cooking: backend preview → user ticks lines → `POST /api/deductions/apply` (backend computes results) → **Undo** of the latest update, kept across refresh, refused if those items changed since. Unknown amounts, incompatible units and items not in My Kitchen are never deducted; nothing goes negative (shortfalls mark the item used up with an unknown amount) |
| Grocery list | Manual + recipe items, purchased, move to kitchen | Implemented (demo) | Add / edit / remove; “Add” on recipe cards and the recipe view adds missing items (recipe amount) and shortages (backend shortfall). Duplicates combine only when the backend says amounts are compatible; otherwise kept separate with a note. Purchased ≠ owned: moving to My Kitchen is a separate two-step, confirmed action. Stored in browser localStorage |
| Platform | Reset demo data | Implemented | Home → “Reset demo data” (confirmation) clears inventory, groceries and the pending undo |
| Platform | Touchscreen layout | Implemented | Designed for 1280×720 landscape; responsive to desktop and phone widths |
| Platform | Device preview / kiosk | Implemented | Desktop "Device preview" shows the app in a simulated 1280×720 bezel; `?mode=kiosk` fills the screen with no bezel. Not yet tested on Pi hardware |
| Platform | Server persistence | Planned | SQLite in Week 3 |

## Architecture
- `frontend/` — React + TypeScript + Vite, no extra runtime dependencies. `src/screens/` (Home, Scan, Kitchen, Recipes, Recipe, Cook), `src/components/` (nav rail, device frame, quantity editor, UI primitives, icons), `src/api.ts`, `src/types.ts`, `src/state.tsx` + `src/storage.ts` (versioned localStorage), `src/router.ts` (hash routes), `src/styles.css`
- `backend/` — FastAPI + Pydantic. `app/models.py` (schemas), `app/units.py` + `app/quantities.py` (units, conversion, comparison), `app/catalog.py` (ingredient catalog), `app/data.py` (sample recipes), `app/matching.py`, `app/deductions.py`, `app/main.py` (routes)
- `device/` — future Raspberry Pi camera adapter (Picamera2 runs only on Raspberry Pi OS)
- `docs/` — scope, architecture, data models, decisions, roadmap, backlog, hardware, journal, portfolio copy

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the proposed schemas in [docs/DATA_MODELS.md](docs/DATA_MODELS.md).

## Quick start (two terminals)
Requires Python 3.11+ and Node.js 18+ (Vite 6). On macOS/Linux:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Then:
```bash
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite (typically `http://127.0.0.1:5173`). The frontend proxies `/api` to FastAPI.

Demo journeys:
1. **Cooking:** Home → Add ingredients (simulated: tap items, verify amounts, save) → My Kitchen → Recipes (servings, time, pantry-staple toggle) → View → Start guided cooking → Finish → **Review inventory usage** → Update My Kitchen → **Undo** (on the confirmation screen, My Kitchen, or Home).
2. **Groceries:** Recipes → **Add** on a recipe card (or “Add missing to grocery list” in the recipe view) → Grocery → tick items as purchased → **Move to My Kitchen…** → check amounts → confirm.

Start over any time with Home → **Reset demo data**.

Display modes:
- **Browser view** (default): responsive layout filling the window.
- **Device preview**: the "Device preview" button at the bottom of the side rail shows the app inside a simulated 1280×720 touchscreen bezel, scaled to fit (desktop windows ≥ 900px wide; the choice is remembered).
- **Kiosk**: open `http://127.0.0.1:5173/?mode=kiosk` — fills the screen with no bezel and no preview toggle (intended for the Pi's Chromium kiosk).

Demo inventory and preferences live in this browser's localStorage under `skh.state`; clear site data to reset.

## Verification
```bash
cd backend
python -m pytest -q      # use "python -m"; bare "pytest" currently fails to import the app
```

```bash
cd frontend
npm run build
```

Browser walkthrough (repeatable; no extra dependencies, needs a local Chrome): with the backend and `npm run dev` running,
```bash
cd frontend
npm run walkthrough      # screenshots + report to <system tmp>/skh-walkthrough; exits 1 on any failure
```
It covers both demo journeys, refresh persistence, undo (including the refused-after-edit case), reset, storage migration, 1280×720 overflow and touch-target checks, device preview, kiosk and a 390×844 phone layout. Set `CHROME_PATH` if Chrome is not at the macOS default location.

Last verified Nov 15, 2026 (Claude Code session on the owner's Mac): backend 108 passed (1 Starlette/httpx deprecation warning); frontend type-check and production build succeeded; walkthrough 29 checks + 11 layout measurements passed with no console errors. Screenshots in `docs/screenshots/`. Not yet tried by hand on a physical touchscreen.

## API endpoints
Implemented:
- `GET /api/health` — health check; reports `mode: seed-demo`, `vision_enabled: false`
- `GET /api/recipes?ingredients=chicken,zucchini&max_minutes=45&servings=2` — match seed recipes
- `GET /api/recipes/{id}` — single recipe (note: returns `match_pct: 0` and empty matched/missing; unused by the UI)
- `GET /api/ingredients` — ingredient catalog (ids, aliases, staple flags)
- `POST /api/recipes/match` — quantity-aware matching; body `{inventory: [...], assume_staples, max_minutes, servings}`; stores nothing
- `POST /api/deductions/preview` — proposed deductions for a recipe; body `{recipe_id, servings_cooked, inventory: [...]}`; **preview only, writes nothing**
- `GET /api/recipes/{id}/full` — complete structured recipe (used by the full recipe view and guided cooking)
- `GET /api/units` — canonical unit codes with dimension
- `POST /api/inventory/stock-status` — derived low-stock status (`out/low/ok/unknown`) for client-supplied inventory; stores nothing
- `POST /api/deductions/apply` — body `{recipe_id, servings_cooked, inventory, include: [ingredient ids]}`; recomputes the preview, applies only confirmed deductible lines, returns updated inventory + an undo `batch`; stores nothing
- `POST /api/deductions/undo` — body `{batch, inventory}`; restores the batch's before-snapshots, or **409** if any affected item changed since
- `POST /api/quantities/combine` — body `{pairs: [{existing, incoming}]}`; sums only when both amounts are known and units compatible, otherwise says why not

The two original GET recipe endpoints keep their v0.1 flat shape for compatibility (ADR-016); the new UI no longer uses them. Interactive docs: `http://127.0.0.1:8000/docs`.

Planned endpoints (scans, inventory, deductions, grocery list) are listed in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#api-roadmap).

## Known issues
- Local Git repository only; no GitHub remote yet.
- Demo inventory, groceries and the pending undo live in one browser's localStorage (`skh.state`, version 2); not shared between devices, lost if site data is cleared.
- Only the most recent cooking update can be undone.
- When a deduction uses up an item, its remaining amount is recorded as unknown (“used up”), not zero; the user can correct it by hand.
- Moving a purchased item whose units can't be combined with the kitchen amount asks the user to keep one amount or the other; the two are never added.
- Sample recipe quantities have known inconsistencies flagged for owner review (see `docs/BACKLOG.md`, SKH-03).
- Low-stock "can't compare" messages show raw unit codes (e.g. "clove", "g").
- Touch interaction has been checked only in a headless browser, not on a physical touchscreen.
- Restricted-instruction recipes show no link to the source URL (no such recipes exist yet).

## Hardware
Decision: Raspberry Pi 5 2GB or 4GB, official Camera Module 3, official 7-inch Touch Display 2. Verify retailer stock, total delivered price, cable and enclosure compatibility before ordering. The 7-inch panel is portrait-native; test landscape layout before enclosure design. See [docs/HARDWARE.md](docs/HARDWARE.md).

## Privacy, safety, rights
- No secrets in git; provider keys stay server-side in environment variables.
- Do not store or log raw food photos by default; validate type and size of uploads.
- AI recognition can be wrong — users always confirm before anything is saved or matched.
- Quantities are never invented; unknown stays unknown, and inventory is only changed after user confirmation.
- Recipe licensing and attribution are checked before storing or displaying full instructions; ratings appear only when a provider supplies them.
- Cooking guidance is informational; use a food thermometer for safe temperatures.
- Inventory and grocery data stay local; phone sync (P2) requires authentication first.

## Course dates
Week 1 progress and portfolio link: Sunday November 15, 2026, 11:59 PM. Class demo: Monday December 7. Final portfolio: Sunday December 13, 11:59 PM.
