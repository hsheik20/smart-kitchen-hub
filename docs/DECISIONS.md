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
