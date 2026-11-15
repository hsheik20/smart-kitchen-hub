# Architecture decision record (ADR)

## ADR-001 — Solo five-week project
Decision: Solo artifact; hardware/software kitchen companion rather than another focus-tracker derivative. Rationale: personal interest, diverse learning, demonstrable artifact.

## ADR-002 — Hybrid recipe providers
Decision: Seed/authorized recipes first, abstract recipe provider interface, integrate TheMealDB or similarly permitted API after core workflow works. Rationale: reliable cooking demo without scraping risk or provider coupling.

## ADR-003 — Separate vision and matching
Decision: AI proposes ingredients; human confirms; deterministic code ranks recipes. Rationale: testability, accuracy and explainability.

## ADR-004 — Cross-platform development
Decision: Mac simulation works before Raspberry Pi arrives. Device adapter isolated; Raspberry Pi camera implemented only on actual hardware. Rationale: avoid losing Week 1 to shipping.

## ADR-005 — Tentative hardware
Decision: Raspberry Pi 5 2GB or 4GB + Camera Module 3 + 7-inch Touch Display 2; exact SKU purchase pending verified retailer quote and total. Rationale: official accessory compatibility, graphical browsing, cost ceiling approximately $250.

## ADR-006 — No unauthorized recipe replication
Decision: Keep provenance, creator attribution, and instruction permission explicitly in recipe model. External discovery can link to original site rather than display unlicensed instructions. Rationale: creator rights, provider terms, maintainability.

---
## Decisions added Nov 14, 2026 (scope v2)
ADR-001 to ADR-006 above are unchanged and still in force unless noted below.

## ADR-007 — Expand product scope to five areas
Decision: Product covers ingredient scanning, recipe discovery, recipe viewing & guided cooking, kitchen inventory, and grocery list. P0 remains the scan → confirm → match → full view → guided cooking flow; inventory quantities, deductions, low stock, and grocery list are P1; voice, personalization, multi-provider/creator imports, advanced substitutions, sensors, and sync are P2. Amends v1 scope, where inventory was P2 and grocery lists were absent. Rationale: owner's finalized vision; P1/P2 tiers protect the 50-hour budget.

## ADR-008 — Quantity model separates availability, amount, and accuracy
Decision: Every quantity is `{amount, unit, accuracy ∈ exact|estimated|unknown, display_text}`; inventory availability is a separate field. Unknown amounts are stored as `null`, never defaulted. Rationale: users often know they have an item but not how much; deductions and comparisons must not rest on invented numbers.

## ADR-009 — Same-dimension unit conversion only
Decision: Convert within mass or within volume using fixed factors; count units match only themselves; no mass↔volume density conversion. Incomparable lines are reported as "can't compare". Rationale: deterministic, testable, avoids silent errors.

## ADR-010 — Append-only inventory transactions; confirm-then-commit deductions with undo
Decision: Inventory changes are recorded as transactions with before/after snapshots. Recipe completion produces a preview; the user confirms an atomic batch; undo writes reversal transactions and is refused if later changes touched the same items. Rationale: user trust, auditability, exact undo.

## ADR-011 — Grocery list is separate from inventory
Decision: Grocery items never count as owned. Marking purchased does not change inventory unless the user explicitly adds the item with a confirmed quantity. Rationale: avoids double counting and false availability.

## ADR-012 — Introduce SQLite in Week 3 for P1 data
Decision: Stay in-memory through Week 2; add a single local SQLite file (git-ignored) for inventory, transactions, grocery items, and cached provider recipes when SKH-12 starts. Library choice (stdlib `sqlite3` vs SQLModel) deferred to that issue. Rationale: persistence is genuinely needed only once inventory exists.

## ADR-013 — One structured recipe record for both views
Decision: Full recipe view and guided cooking mode render the same `Recipe` object (structured ingredients, steps with ingredient references, notes, substitutions, safety cautions). Rationale: no content drift between views; quantities available in cooking mode.

## ADR-014 — Every simulated feature is labelled
Decision: Simulated scanning and demo inventory/grocery data are visibly labelled in the UI and in the README feature-status table until backed by tested functionality. Rationale: academic honesty and CLAUDE.md rule 5.

## ADR-015 — Phone/multi-device access deferred and gated on auth
Decision: Phone sync is P2; until authentication and HTTPS exist, the backend binds to localhost/LAN only. Rationale: inventory and photos are personal data.

---
## Decisions added Nov 14, 2026 (Phase 2 backend: structured recipes and deterministic logic)
ADR-001 to ADR-015 are unchanged.

## ADR-016 — Structured `Recipe` is canonical; legacy GET endpoints are an adapter
Decision: `backend/app/data.py` stores the four original sample recipes as structured `Recipe` records (quantities, notes, substitutions, safety cautions, `RecipeSource` with `is_sample_data: true`), validated against the schema and ingredient catalog at import. `GET /api/recipes` and `GET /api/recipes/{id}` keep their v0.1 flat response shape by deriving it from the structured record (required ingredient names only; step text only), so the current frontend works unchanged. Rationale: one source of truth (ADR-013) without a frontend change in this phase. The flat shape is retired once the full recipe view (SKH-05) consumes the structured record.

## ADR-017 — Stateless matching and deduction preview until SQLite
Decision: Until persistence exists (ADR-012), `POST /api/recipes/match` and `POST /api/deductions/preview` take inventory records in the request body and store nothing. One inventory record per ingredient per request; duplicates (after alias resolution) are rejected with 422 because there is no rule for which record a deduction should use. Unknown explicit `ingredient_id`s are rejected; unmapped names are kept and returned in `unmapped_inventory`. Rationale: lets matching and deduction logic be built and tested now without pulling SKH-12 forward.

## ADR-018 — Pantry-staple assumption is opt-in and presence-only
Decision: Catalog ingredients may be flagged `is_staple` (oil, salt, black pepper, water). Matching accepts `assume_staples` (default `false`). When true, a *required* staple that is absent from inventory gets status `assumed_staple`, counts as present for `match_pct`, and is listed in `assumed_staples` and `rank_reasons`. It is never quantity-compared, never overrides an actual inventory record, and never produces a deduction. Rationale: resolves the DATA_MODELS open question on staples without inventing availability or quantities; the user sees exactly what was assumed.

## ADR-019 — Decimal amounts, reporting precision, and rounding direction
Decision: Amounts are `Decimal`, serialized as JSON strings (e.g. `"14.787"`), and accepted as numbers or strings. Conversions and comparisons use full precision in the shared unit; reported amounts are rounded to 0.001 of their unit. Shortfalls and deductions round **up** and remaining stock rounds **down**, so a real shortfall never displays as zero and remaining stock is never overstated. Scaling by servings never rounds a requirement to zero. Rationale: deterministic, testable output with conservative error direction.

## ADR-020 — Servings scaling and optional ingredients in matching/deductions
Decision: When both the requested servings and the recipe's servings are known, required amounts are scaled by `requested / recipe` (unknown amounts stay unknown; the original `display_text` is dropped because it no longer describes the scaled amount). Otherwise amounts are used as written and a reason/warning says so. Optional ingredients are excluded from `match_pct` (reported as `optional_missing` when absent) and default to `include: false` in deduction previews. A preview line that would use all remaining stock, or more than inventory shows, is `will_deduct_to_zero` with `proposed_availability: out` for the user to review. Rationale: shortages and deductions are meaningless unless they reflect the amount actually cooked; optional ingredients may not have been used.

---
## Decisions added Nov 14, 2026 (Phase 3 part 1: touchscreen frontend)
ADR-001 to ADR-020 are unchanged.

## ADR-021 — Frontend calls the backend for every quantity decision
Decision: The browser never compares, converts, scales, or sums quantities. Matching, shortfalls, servings scaling and low-stock status come from the API (`POST /api/recipes/match`, `POST /api/inventory/stock-status`); the UI only formats returned values. Two small read endpoints were added so the UI does not duplicate backend data: `GET /api/recipes/{id}/full` (structured recipe) and `GET /api/units`. The browser does map typed names to catalog ids using the catalog's own aliases, only to keep one inventory item per ingredient; the backend still validates. Rationale: CLAUDE.md rule 4 (deterministic, tested logic in one place).

## ADR-022 — Demo inventory and preferences in versioned localStorage
Decision: Until SQLite (ADR-012), My Kitchen items and UI preferences (servings, time limit, staples toggle, device preview, last cooking position) are stored in browser localStorage under `skh.state` with `version: 1`. A missing or different version, or unreadable data, resets to empty with a visible notice; no silent migration. The UI labels this as demo inventory stored only in this browser. Saving from the simulated scan replaces an existing item's amount after the user sees "Replaces current: …" and confirms by saving. Rationale: a usable demo without pulling persistence forward, while staying honest about where data lives.

## ADR-023 — Display modes: browser, device preview, kiosk
Decision: The same app renders in three modes. Browser view fills the window responsively. Device preview (a desktop presentation aid, remembered in preferences, only on windows ≥ 900px wide) renders the app at exactly 1280×720 inside a simulated bezel scaled to fit. Kiosk (`?mode=kiosk`) fills the screen with no bezel or toggle and ignores the preview preference. Layout uses CSS container queries on the app root so breakpoints respond to the app's own size, which keeps the framed preview identical to the real 1280×720 screen. Rationale: present the hardware concept on a laptop without implying the Pi build exists, and keep one layout path.

## ADR-024 — No new frontend dependencies
Decision: Hash-based routing, icons (inline SVG), and UI components are written in-project instead of adding a router, icon or component library. Rationale: small bundle for the Pi, fewer supply-chain and upgrade risks in a five-week project.

---
## Decisions added Nov 15, 2026 (Phase 3 part 2: grocery list and confirmed deductions)
ADR-001 to ADR-024 are unchanged.

## ADR-025 — Stateless apply/undo for cooking deductions
Decision: `POST /api/deductions/apply` takes the client's inventory and the list of lines the user ticked, recomputes the preview on the server, and applies only lines whose status is `will_deduct` / `will_deduct_to_zero`. It returns the full updated inventory and a `DeductionBatch` with before/after snapshots of each changed item. A line that would reach or pass zero marks the item `out` with quantity **unknown** (`display_text: "used up"`), never zero or negative, because the true remainder isn't known. `POST /api/deductions/undo` restores the before-snapshots only if every affected item still equals its after-snapshot (otherwise 409, all-or-nothing). The browser stores only the latest batch (survives refresh). Rationale: keeps all arithmetic and the undo safety rule in tested backend code (ADR-010, ADR-021) without pulling SQLite forward; the snapshot comparison is the stateless stand-in for "no later transaction touched these items".

## ADR-026 — Grocery list in the browser; combine quantities only when compatible
Decision: Grocery items live in browser localStorage next to the demo inventory. Adding an ingredient already on the unpurchased list asks `POST /api/quantities/combine`: amounts are summed (in the existing unit, least-certain accuracy) only when both are known and compatible; otherwise the new entry is kept as a separate line with a note, or skipped if it has no amount. Moving purchased items to My Kitchen is a separate two-step action: the user checks amounts, sees the result per item (new / restock / added / can't combine), and for incompatible units explicitly chooses which amount to keep. Supersedes the DATA_MODELS rule "otherwise the quantity becomes unknown with a note", which would discard information. Rationale: ADR-011 (grocery ≠ inventory), CLAUDE.md rule 6 (no silent merges, no invented amounts).

## ADR-027 — Browser storage version 2
Decision: `skh.state` moves to `version: 2` (`inventory`, `groceries`, `lastDeduction`, `prefs`). Version 1 data is migrated explicitly (inventory and preferences kept, empty grocery list); any other version or unreadable data resets with a visible notice. "Reset demo data" (with confirmation) clears inventory, groceries, the pending undo and the cooking position, and keeps display preferences. Rationale: adding groceries without discarding a user's demo inventory.

---
## Decisions added Nov 15, 2026 (deployment preparation)
ADR-001 to ADR-027 are unchanged except where ADR-028 narrows ADR-015.

## ADR-028 — Public stateless demo deployment on Render; configuration by environment
Decision: The demo may be deployed publicly as a Render static site (frontend) plus a Render web service (backend). This narrows ADR-015 (backend on localhost/LAN only until authentication): the deployed backend stores nothing — no inventory, groceries, photos, accounts or logs of user data; every request carries the browser's demo data and receives a computed result — so there is no personal data to protect server-side. Phone sync, uploads, persistence and anything storing user data remain gated on authentication + HTTPS as ADR-015 says. Configuration is by non-secret environment variables only: `VITE_API_BASE_URL` (frontend, build time; unset = relative `/api` through the Vite dev proxy) and `CORS_ORIGINS` (backend; explicit comma-separated origins, `*` refused at startup, unset = local dev origins). CORS allows `GET` and `POST` with `Content-Type` only, no credentials. Hash routing means the static site needs no rewrite rules. Rationale: a shareable demo for the course without weakening the privacy rule for features that will store data.
