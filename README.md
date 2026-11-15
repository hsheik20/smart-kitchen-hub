# Smart Kitchen Hub — TCSS 490 Artifact 5 (Moonshot)

**Project:** A Raspberry Pi–powered cooking assistant that combines camera-based ingredient recognition, recipe discovery, guided cooking, kitchen inventory, and grocery planning.

**Current state (Nov 14, 2026):** Week 1 scaffold. A *simulated* "scan → recipe match → cooking steps" flow exists: ingredients are picked by hand from a fixed list. There is **no camera capture, AI recognition, inventory, grocery list, quantity tracking, or persistence yet**. Do not describe the simulator as a working scanner.

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
| Scanning | Ingredient "scan" | Simulated | Toggle 8 fixed ingredient chips; banner says SIMULATION MODE |
| Scanning | Edit/add ingredient names, quantity entry | Planned | P0 (edit), P0/P1 (quantity) — Week 2 |
| Scanning | Pi camera capture, AI recognition | Planned | Week 2; hardware not yet purchased |
| Discovery | Curated demo recipes | Implemented | 4 original recipes in `backend/app/data.py`; names only, no quantities |
| Discovery | Ingredient matching (matched/missing/%) | Implemented | Presence-only; normalisation + small alias table |
| Discovery | Max cook-time filter | Implemented | Tested |
| Discovery | Servings | Partial | Accepted by API; not used to filter or scale |
| Discovery | Preferences, external provider, ratings | Planned | Seed recipes have no ratings (`null`), UI says "unavailable" |
| Viewing & cooking | Guided cooking (previous/next) | Implemented | Steps are plain strings |
| Viewing & cooking | Full recipe view with quantities/notes/substitutions/safety | Planned | Current detail view lists ingredient names only |
| Viewing & cooking | Timers | Planned | Enhancement (P1) |
| Inventory | Saved ingredients, quantities, deductions, undo, low stock | Planned | P1; needs SQLite (Week 3) |
| Grocery list | Missing/manual items, purchased status | Planned | P1 |
| Platform | Persistence | Planned | In-memory only today; SQLite in Week 3 |

## Architecture
- `frontend/` — React + TypeScript + Vite touch-oriented UI (currently one file, `src/main.tsx`)
- `backend/` — FastAPI + Pydantic; seed recipes and deterministic matching (currently `app/main.py`, `app/data.py`)
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

Open the URL printed by Vite (typically `http://127.0.0.1:5173`). Select simulated ingredients, find matching seed recipes, and open cooking mode. The frontend proxies `/api` to FastAPI.

## Verification
```bash
cd backend
python -m pytest -q      # use "python -m"; bare "pytest" currently fails to import the app
```

```bash
cd frontend
npm run build
```

Last verified Nov 14, 2026 (Claude Code session on the owner's Mac): backend 5 passed (1 Starlette/httpx deprecation warning); frontend type-check and production build succeeded. The UI has not yet been screenshotted.

## API endpoints
Implemented:
- `GET /api/health` — health check; reports `mode: seed-demo`, `vision_enabled: false`
- `GET /api/recipes?ingredients=chicken,zucchini&max_minutes=45&servings=2` — match seed recipes
- `GET /api/recipes/{id}` — single recipe (note: returns `match_pct: 0` and empty matched/missing; unused by the UI)

Planned endpoints (scans, inventory, deductions, grocery list) are listed in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#api-roadmap).

## Known issues
- Project folder name ends with a trailing space (`smart-kitchen-hub `); rename before creating the Git repository.
- Not yet a Git repository; no GitHub URL.
- Frontend error message says "Cannot reach the backend" even for validation (422) errors.
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
