# Priority issue backlog — v2 (Nov 14, 2026; copy to GitHub Issues once the repository exists)

Renumbered on Nov 14 for the v2 scope (ADR-007). The v1 list (SKH-01–15) was never filed as GitHub issues. Status: **Done**, **Partial**, **Not started**.

## P0 — end-to-end scan → recipe → cooking
| ID | Issue | Acceptance criteria | Target | Status |
|---|---|---|---|---|
| SKH-01 | Bootstrap repo, backend/frontend, documentation | Git repo + GitHub URL; fresh-clone instructions work; health endpoint; UI builds; tests pass | W1 | Partial — scaffold, docs, tests pass; no Git repo |
| SKH-02 | Simulated scan + ingredient confirmation UI | "SIMULATION" label; user can select, remove, rename, and add free-text ingredients; ingredients come from `GET /api/ingredients` | W1/W2 | Partial — toggle of 8 fixed chips only |
| SKH-03 | Structured recipe schema + seed recipes | `Recipe` model per DATA_MODELS.md; ≥3 owner-authored recipes with quantities, notes, substitutions, safety cautions, provenance; schema validated at load; tests | W2 | Partial — 4 recipes, string ingredients, no quantities |
| SKH-04 | Deterministic matcher + ranking reasons | Matched/missing/match %, `rank_reasons`; tests for zero match, aliases, unmapped names, time filter; quantity checks (P1 extension) | W1/W3 | Partial — presence match + time filter; no zero-match test or reasons |
| SKH-05 | Full recipe view | Shows ingredients with quantities, directions, notes, substitutions, safety cautions, source attribution; link to source when instructions restricted | W2 | Not started |
| SKH-06 | Guided cooking mode | Touch-friendly previous/next from the same `Recipe` record as SKH-05; step shows referenced ingredient quantities; only permitted steps | W1/W2 | Partial — prev/next over string steps |
| SKH-07 | Pi camera capture adapter | Captures image on Pi, validates result, uploads to backend, deletes local copy; setup documented; fallback preserved; not imported by backend tests | W2 | Not started (hardware not ordered) |
| SKH-08 | Image upload + vision adapter | `POST /api/scans` with size/type validation; `MockVision` + one real service; structured candidates; errors handled; no fake confidence | W2 | Not started |
| SKH-09 | Confirmation with quantity entry → recommendations | Per ingredient: exact / estimated / skip, amount + unit; availability stored separately; confirmed set drives matching; end-to-end test | W2 | Not started |
| SKH-20 | Final demo + portfolio + reflection | Dec 7 demo; Dec 13 final submitted; logs complete | W5 | Not started |

## P1 — inventory, grocery, better discovery
| ID | Issue | Acceptance criteria | Target | Status |
|---|---|---|---|---|
| SKH-10 | External recipe provider (TheMealDB) | Terms reviewed and recorded; data mapped to `Recipe` with attribution; unparseable measures → `unknown` with original text; no ratings invented; errors/timeouts fall back to seed | W3 | Not started |
| SKH-11 | Recommendation filters | Time limit enforced; servings scale quantities when known, otherwise informational (documented); excluded-ingredient preference | W3 | Partial — time filter only |
| SKH-12 | SQLite persistence + inventory CRUD | Inventory items with `Quantity` (exact/estimated/unknown), availability separate; every change writes a transaction; DB file git-ignored; tests | W3 | Not started |
| SKH-13 | Unit handling + quantity comparison | Canonical units; same-dimension conversion only; incompatible → "can't compare"; accuracy propagation; unit tests | W3 | Not started |
| SKH-14 | Recipe-completion deductions + undo | Preview writes nothing; skips unknown/incompatible/not-in-inventory with reasons; confirm is atomic batch; undo restores snapshots; tests incl. undo-after-later-change refusal | W4 | Not started |
| SKH-15 | Low-stock indicators | User-set threshold; derived `low/ok/unknown/out`; shown in inventory UI; tests | W4 | Not started |
| SKH-16 | Grocery list | Add recipe-missing items and manual items; optional quantity; purchased toggle; merge duplicates; separate from inventory; tests | W3 | Not started |
| SKH-17 | Pi touchscreen kiosk integration | Full navigation on the physical display; orientation decided | W4 | Not started |
| SKH-18 | Step timers + error states | Timers only where the recipe states a duration; retry/error screens; no false food-safety claims | W4 | Not started |
| SKH-19 | Week 1 visual demo of all five areas | Inventory and grocery screens with sample data, each labelled **DEMO DATA**; no backend persistence implied | W1 | Not started |

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
