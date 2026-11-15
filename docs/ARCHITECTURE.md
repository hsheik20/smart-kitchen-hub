# Architecture — v2 (Nov 14, 2026)

Status markers: **[built]** exists in code today, **[sim]** simulated stand-in, **[planned]** not yet implemented.

## Context and flow
```
 [Pi Camera Module 3 + Picamera2]  or  [Mac upload / simulated selection]   (device adapter)
                 |                                   |
                 +---------------> POST /api/scans <-+          [planned; today: [sim] chip selection]
                                        |
                                 [Vision adapter]  (external AI service; mock adapter for dev)
                                        v
                             [Ingredient candidates]
                                        |
                     [User confirms/edits + optional quantity]   exact | estimated | unknown
                                        v
            +---------------------------+-----------------------------+
            v                                                         v
   [Inventory service] <-- transactions log (SQLite)        [Recipe matching & ranking] <-- [Recipe providers]
     |   ^      low-stock check                                       |       seed [built], TheMealDB [planned]
     |   |                                                            v
     |   +-- confirm/undo deductions <-- [Recipe completion]   [Full recipe view] + [Guided cooking mode]
     |                                                                |   (same structured Recipe record)
     +-- shortfalls/low stock ------> [Grocery list] <-- missing ingredients
                                              |
                                    [React touchscreen UI]  (Pi kiosk browser / Mac / phone later)
```
Mac development uses simulated scanning; production adds device capture and vision.

## Components
- **Device adapter** [planned] — `device/`. Picamera2 on Raspberry Pi OS captures a still, uploads to the backend over the LAN, deletes the local file. Must run independently of backend tests; simulator/upload fallback always available.
- **Backend API** [built: health + recipes] — FastAPI. Validates all inputs with Pydantic, orchestrates adapters, owns all business rules (matching, units, deductions).
- **Vision adapter** [planned] — interface `recognize(image) -> list[IngredientCandidate]`; implementations: `MockVision` (deterministic, for tests/demo) and one external AI service. Never writes inventory directly.
- **Recipe providers** [partial] — `RecipeProvider` interface returning canonical `Recipe` objects. `SeedProvider` (original recipes; currently a plain list in `data.py`), `TheMealDBProvider` [planned]. Providers declare instruction-display permission per recipe.
- **Ingredient catalog & normalizer** [partial] — canonical ingredient IDs plus aliases; today a 6-entry alias dict in `main.py`.
- **Unit service** [planned] — canonical units, same-dimension conversions only (mass, volume; count units match identically).
- **Matcher/ranker** [built, presence-only] — compares confirmed ingredients to recipe ingredients; returns matched, missing, match %, and (planned) quantity checks and ranking reasons.
- **Inventory service** [partly built] — deduction preview / apply / undo and low-stock evaluation exist as stateless endpoints over client-supplied inventory (ADR-017, ADR-025). Stored items and the append-only transaction log remain planned with SQLite.
- **Grocery** [built Nov 15 as browser demo data] — items in versioned localStorage; never mutates inventory implicitly. Duplicate amounts are combined only via `POST /api/quantities/combine`. A server-side grocery service remains planned with SQLite.
- **Frontend** [built Nov 14: Home, Scan (simulated), My Kitchen, Recipes, Recipe (full view), Cook (guided); Nov 15: Grocery, deduction Review] — React/TS, no router or UI library. Hash routes (`#/scan`, `#/recipe/{id}`, `#/cook/{id}/{step}`). Demo inventory and UI preferences in versioned localStorage (ADR-022). All quantity, matching, scaling and low-stock logic is called from the backend; the browser only formats values. Layout targets 1280×720 and uses CSS container queries so the same breakpoints apply inside the desktop device-preview bezel. `?mode=kiosk` for the Pi (ADR-023).

Schemas for all of the above: [DATA_MODELS.md](DATA_MODELS.md).

## Planned code layout
Created only when the corresponding backlog item starts (no empty placeholder files):
```
backend/app/
  main.py              app factory, router registration
  schemas/             quantity.py, recipe.py, scan.py, inventory.py, grocery.py
  services/            normalize.py, units.py, matching.py, inventory.py, grocery.py
  providers/           base.py, seed.py, themealdb.py
  vision/              base.py, mock.py, <service>.py
  routers/             recipes.py, scans.py, inventory.py, grocery.py
  db.py                SQLite connection/migrations (P1)
backend/tests/         one test module per service + API tests
device/                capture.py, upload.py (Pi only; not imported by backend)
frontend/src/          (as built Nov 14)
  api.ts, types.ts     typed fetch client + API types
  state.tsx, storage.ts  app state; versioned localStorage (demo inventory, prefs)
  router.ts, hooks.ts  hash router; data hooks (match, recipe)
  screens/             Home, Scan, Kitchen, Recipes, Recipe, Cook (+ recipeParts)
  components/          NavRail, DeviceFrame, QuantityEditor, ui primitives, Icon
```

## Data strategy
- Weeks 1–2: in-memory seed data; no database.
- Week 3: SQLite (single local file, git-ignored) for inventory items, inventory transactions, grocery items, and cached provider recipes (within provider terms). Stdlib `sqlite3` or SQLModel — decide when SKH-12 starts.
- Scan sessions keep candidates only; images are discarded after recognition unless the user opts in.
- Recipe ingestion keeps source links, attribution, and permission status. No scraping without access/use review.

## API roadmap
Implemented:
- `GET /api/health`
- `GET /api/recipes?ingredients=&max_minutes=&servings=` (presence-based match)
- `GET /api/recipes/{id}`
- `GET /api/ingredients` (Nov 14)
- `POST /api/recipes/match` — quantity-aware matching; inventory in request body, stateless (ADR-017) (Nov 14)
- `POST /api/deductions/preview` — deduction preview; inventory in request body, writes nothing (Nov 14).
- `GET /api/recipes/{id}/full` — structured `Recipe` (Nov 14, Phase 3)
- `GET /api/units` — unit codes + dimension (Nov 14, Phase 3)
- `POST /api/inventory/stock-status` — derived low-stock status; stateless (Nov 14, Phase 3)
- `POST /api/deductions/apply`, `POST /api/deductions/undo` — confirmed deduction and exact undo; stateless (Nov 15, ADR-025)
- `POST /api/quantities/combine` — compatible-only quantity sums for grocery merges and grocery → kitchen moves (Nov 15, ADR-026)

(`POST /api/deductions/preview` replaced the planned `POST /api/recipes/{id}/deduction-preview` path.)

Planned (shape may change; see DATA_MODELS.md):
| Method & path | Purpose | Priority |
|---|---|---|
| `POST /api/scans` | Create scan from `simulated` list, uploaded image, or Pi capture (multipart, validated) | P0 |
| `GET /api/scans/{id}` | Candidates and status | P0 |
| `POST /api/scans/{id}/confirm` | Confirmed ingredients + optional quantities; optionally save to inventory | P0 (save: P1) |
| `GET /api/recipes` (extended) | Matching using inventory or explicit list, filters, ranking reasons | P0/P1 |
| `GET/POST/PATCH/DELETE /api/inventory[/{id}]` | Inventory items (every change writes a transaction) | P1 |
| `GET /api/inventory/transactions` | Change history | P1 |
| `POST /api/deductions/preview` (persisted inventory) | Read inventory from SQLite instead of the request body | P1 |
| `POST /api/inventory/deductions` | Confirm a proposal (atomic batch) | P1 |
| `POST /api/inventory/deductions/{batch_id}/undo` | Reverse a batch | P1 |
| `GET/POST/PATCH/DELETE /api/grocery[/{id}]` | Grocery items | P1 |
| `POST /api/grocery/from-recipe/{id}` | Add missing (and optionally short) ingredients | P1 |
| `GET /api/providers/status` | Provider availability | P2 |

## Operational risks
- Vision false predictions → mandatory confirmation; candidates never saved directly
- Wrong or rough quantities → accuracy flag on every quantity; deductions previewed, confirmed, undoable
- Unit mismatch (e.g. "1 cup rice" vs "500 g rice") → skip and show "can't compare", never guess density
- Recipe API unavailable/rate limited → seed fallback; cache only under provider terms
- Copyrighted steps → display only when permitted; otherwise link to the source
- No provider ratings → show "unavailable", never zero or invented
- Pi touchscreen orientation/cable fit → test before enclosure work
- Hardware late → Mac upload/simulation keeps the demo working
- Expanded scope vs 50-hour budget → P0 freeze before P1; P1 may ship partial and labelled
- API credentials/cost → server-side secrets, request caps

## Security
Private-by-default uploads; cap size and allowed MIME types; strip metadata; no user-supplied file paths. Bind to localhost/LAN only; no public unauthenticated endpoints. Phone/multi-device access (P2) requires authentication and HTTPS before it is enabled. Sanitize logs (no images, no keys).
