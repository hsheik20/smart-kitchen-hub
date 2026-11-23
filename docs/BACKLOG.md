# Priority issue backlog — v2 (Nov 14, 2026; copy to GitHub Issues once the repository exists)

Renumbered on Nov 14 for the v2 scope (ADR-007). The v1 list (SKH-01–15) was never filed as GitHub issues. Status: **Done**, **Partial**, **Not started**.

## P0 — end-to-end scan → recipe → cooking
| ID | Issue | Acceptance criteria | Target | Status |
|---|---|---|---|---|
| SKH-01 | Bootstrap repo, backend/frontend, documentation | Git repo + GitHub URL; fresh-clone instructions work; health endpoint; UI builds; tests pass | W1 | Partial — scaffold, docs, tests pass; no Git repo |
| SKH-02 | Simulated scan + ingredient confirmation UI | "SIMULATION" label; user can select, remove, rename, and add free-text ingredients; ingredients come from `GET /api/ingredients` | W1/W2 | Done (Nov 14) — SIMULATED SCAN banner; select from `GET /api/ingredients`, remove, add free text (catalog alias match or kept as typed and flagged); fixed "sample suggestions" labelled as not recognition. Rename of a selected item is not supported (remove + re-add) |
| SKH-03 | Structured recipe schema + seed recipes | `Recipe` model per DATA_MODELS.md; ≥3 owner-authored recipes with quantities, notes, substitutions, safety cautions, provenance; schema validated at load; tests | W2 | Partial (backend done Nov 14) — `Recipe` schema implemented; 4 original sample recipes with quantities, notes, substitutions, safety cautions, provenance, validated at load; tests. Open: quantities were AI-drafted and need **owner review** — see “Sample recipe review flags” below |
| SKH-04 | Deterministic matcher + ranking reasons | Matched/missing/match %, `rank_reasons`; tests for zero match, aliases, unmapped names, time filter; quantity checks (P1 extension) | W1/W3 | Partial (backend done Nov 14) — `POST /api/recipes/match` with `rank_reasons`, quantity checks, shortfalls, servings scaling, opt-in staple assumption; tests for zero match, aliases, unmapped names, time filter. Open: UI still uses presence-only `GET /api/recipes` |
| SKH-05 | Full recipe view | Shows ingredients with quantities, directions, notes, substitutions, safety cautions, source attribution; link to source when instructions restricted | W2 | Done (Nov 14) — `GET /api/recipes/{id}/full`; quantities (scaled when servings differ), preparation, directions, substitutions, notes, safety cautions, source + licence note; source link when instructions restricted (code path present; no restricted recipe exists to demo) |
| SKH-06 | Guided cooking mode | Touch-friendly previous/next from the same `Recipe` record as SKH-05; step shows referenced ingredient quantities; only permitted steps | W1/W2 | Done (Nov 14) — same `Recipe` record; one step per screen, 76px Previous/Next, tappable progress, step ingredients with amounts, safety notes; links to/from full recipe. Not yet tried on the physical display |
| SKH-07 | Pi camera capture adapter | Captures image on Pi, validates result, uploads to backend, deletes local copy; setup documented; fallback preserved; not imported by backend tests | W2 | Partial (Nov 22) — Pi 5 + Raspberry Pi OS + Arducam IMX708 set up; ribbon-cable issue fixed; test image captured on the Pi. No capture/upload adapter code yet; validation, upload and local-copy deletion not started |
| SKH-08 | Image upload + vision adapter | `POST /api/scans` with size/type validation; `MockVision` + one real service; structured candidates; errors handled; no fake confidence | W2 | Not started |
| SKH-09 | Confirmation with quantity entry → recommendations | Per ingredient: exact / estimated / skip, amount + unit; availability stored separately; confirmed set drives matching; end-to-end test | W2 | Partial (Nov 14) — exact / estimate / unknown + amount + unit per item; availability stored separately; confirmed items drive matching. Saved to browser demo inventory, not server; no automated end-to-end test in the repo (scripted browser walkthrough only) |
| SKH-20 | Final demo + portfolio + reflection | Dec 7 demo; Dec 13 final submitted; logs complete | W5 | Not started |

## P1 — inventory, grocery, better discovery
| ID | Issue | Acceptance criteria | Target | Status |
|---|---|---|---|---|
| SKH-10 | External recipe provider (TheMealDB) | Terms reviewed and recorded; data mapped to `Recipe` with attribution; unparseable measures → `unknown` with original text; no ratings invented; errors/timeouts fall back to seed | W3 | Not started |
| SKH-11 | Recommendation filters | Time limit enforced; servings scale quantities when known, otherwise informational (documented); excluded-ingredient preference | W3 | Partial — time filter only |
| SKH-12 | SQLite persistence + inventory CRUD | Inventory items with `Quantity` (exact/estimated/unknown), availability separate; every change writes a transaction; DB file git-ignored; tests | W3 | Not started |
| SKH-13 | Unit handling + quantity comparison | Canonical units; same-dimension conversion only; incompatible → "can't compare"; accuracy propagation; unit tests | W3 | Done (backend, Nov 14) — `units.py`/`quantities.py`; tested. Pulled forward from W3 with owner approval (Phase 2) |
| SKH-14 | Recipe-completion deductions + undo | Preview writes nothing; skips unknown/incompatible/not-in-inventory with reasons; confirm is atomic batch; undo restores snapshots; tests incl. undo-after-later-change refusal | W4 | Done as browser demo (Nov 15) — preview UI separates deductible from skipped lines with reasons; user ticks lines; `POST /api/deductions/apply` (backend-computed, never negative, unknown never guessed); undo of the latest batch via `POST /api/deductions/undo`, refused (409) if items changed since; survives refresh; tests incl. undo-after-later-change refusal. Server-side transaction log waits for SKH-12 |
| SKH-15 | Low-stock indicators | User-set threshold; derived `low/ok/unknown/out`; shown in inventory UI; tests | W4 | Partial (Nov 14) — user-set threshold in My Kitchen; derived status from `POST /api/inventory/stock-status` (tested); shown only when comparable. Uses browser demo inventory until SKH-12 |
| SKH-16 | Grocery list | Add recipe-missing items and manual items; optional quantity; purchased toggle; merge duplicates; separate from inventory; tests | W3 | Done as browser demo (Nov 15) — manual and recipe items (missing + backend shortfall), optional quantity, edit/remove, purchased toggle, compatible-only merge via `POST /api/quantities/combine` (tested), separate from inventory; confirmed two-step move to My Kitchen. localStorage until SKH-12 |
| SKH-17 | Pi touchscreen kiosk integration | Full navigation on the physical display; orientation decided | W4 | Partial (Nov 14) — `?mode=kiosk` full-screen mode and 1280×720 layout verified in headless Chrome only. Pi 5 and touchscreen acquired (Nov 22); the app has not yet been run on the physical display |
| SKH-18 | Step timers + error states | Timers only where the recipe states a duration; retry/error screens; no false food-safety claims | W4 | Not started |
| SKH-19 | Week 1 visual demo of all five areas | Inventory and grocery screens with sample data, each labelled **DEMO DATA**; no backend persistence implied | W1 | Done (Nov 15) — inventory and grocery screens built and labelled as demo data stored in this browser |

## P2 — if time remains
| ID | Issue | Acceptance criteria |
|---|---|---|
| SKH-21 | Rating-aware ranking | Only provider-verified ratings; missing stays null |
| SKH-22 | Permitted creator-site imports | Only sites whose terms/robots permit; attribution and link preserved; instructions shown only if allowed |
| SKH-23 | Personalization / conversational preferences | AI may interpret preferences; deterministic matching remains authoritative |
| SKH-24 | Phone access / multi-device sync | Authentication + HTTPS before exposure beyond localhost |
| SKH-25 | Voice controls for cooking mode | Next/previous/repeat by voice |
| SKH-26 | Advanced substitutions | Substitutions considered in matching, labelled |
| SKH-27 | Optional sensors (e.g. kitchen scale) | Exact quantities from hardware, user still confirms |

## Old → new ID map (v1 → v2)
SKH-01→01, 02→02, 03→03, 04→04, 05→05+06, 06→07, 07→08, 08→09, 09→10, 10→11, 11→17, 12→18, 13→20, 14→21, 15→23.

## Issue template
**Context:**
**User value:**
**Acceptance criteria:**
**Out of scope:**
**Dependencies:**
**Verification:**
**Hours/log:**

## Sample recipe review flags (Nov 15, for owner review — nothing was changed)
Found while testing grocery and deduction flows. These are consistency observations, not verified kitchen measurements.
1. **Rice by mass only.** Both rice recipes state 150 g uncooked. Rice stored in cups can't be compared or deducted (no density conversion, ADR-009). Decide whether to state cups instead of, or as well as, grams.
2. **Count units ignore size.** “1 large” and “2 medium” sweet potatoes and “1 medium” zucchini are all counted as whole items, so a large and a small item deduct the same amount.
3. **Salt is inconsistent.** “To taste” (never checked or deducted) in two recipes; 1/2 tsp and 1/4 tsp in the other two.
4. **Sheet-Pan timing.** 15 min prep + 30 min cook = 45 min, but preheating to 400°F plus 25–30 min roasting may exceed this.
5. **Untracked water.** Sweet Potato Skillet steams with “a splash of water”, which isn't an ingredient line (noted in the recipe).
6. **Oil in the rice bowl.** 1 tbsp is used to cook both the chicken and the zucchini; check that it's enough.
