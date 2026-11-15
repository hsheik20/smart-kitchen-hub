# Product scope and success criteria — v2 (Nov 14, 2026)

Supersedes v1 (Nov 12), which covered scanning, recipe discovery, and cooking only and listed inventory as a P2 stretch. Rationale for the change: ADR-007 in `DECISIONS.md`.

## Vision
Smart Kitchen Hub is a Raspberry Pi–powered cooking assistant that combines camera-based ingredient recognition, recipe discovery, interactive cooking guidance, ingredient inventory management, and grocery planning.

## Problem
Home cooks juggle what they have, what recipes need, what they are missing, and instructions spread across screens. Recipe discovery is fragmented and pantry knowledge lives in their head.

## Key user story
A home cook has chicken, zucchini, rice, and sweet potato. They scan the ingredients, correct any wrong prediction, and enter "about 500 g" of chicken while skipping quantities for the rest. They ask for two servings under 45 minutes, see ranked recipes with missing ingredients, add the missing garlic to the grocery list, read the full recipe, cook in step-by-step mode, and on completion confirm a proposed deduction of the chicken they used — with the option to undo.

## Product areas and requirements

### 1. Ingredient scanning
- Capture ingredients with the Raspberry Pi camera; AI recognition is integrated in Week 2.
- Before hardware/AI: a clearly labelled simulated scan (manual selection or file upload).
- User confirms, removes, renames, or adds ingredients; nothing is saved or matched unconfirmed.
- After confirmation, the user may enter an **exact** quantity, an **estimated** quantity, or **skip** (unknown).
- Availability ("I have it") is stored separately from quantity and its accuracy.

### 2. Recipe discovery
- Hybrid sources: original curated demo recipes first, then one supported external provider (TheMealDB is the initial candidate, pending terms review).
- Later (P2): permitted imports from creator websites only where terms/robots allow and attribution is preserved.
- Recommendations consider available ingredients, missing ingredients, cooking time, serving size, and preferences; ranking is deterministic and explained.
- Show source attribution. Show ratings/review counts only when the provider supplies verified values; otherwise "unavailable". Never reproduce restricted instructions — link to the source instead.

### 3. Recipe viewing and cooking
- Full recipe view: ingredients with quantities, directions, notes, substitutions, and relevant safety cautions (e.g. internal temperatures).
- Separate guided cooking mode with touch-friendly step navigation.
- Both views render the same structured recipe record.
- Recipe-specific step timers are an enhancement.

### 4. Kitchen inventory
- Save confirmed scanned (or manually added) ingredients.
- Quantities are exact, estimated, or unknown, with structured amount + unit.
- Compare known quantities against recipe requirements (enough / not enough / can't tell).
- On recipe completion, propose deductions from the recipe's required quantities (scaled by servings when both are known). The user reviews and confirms; the deduction can be undone.
- Never deduct across incompatible units or invent unknown quantities — such lines are skipped and shown as skipped.
- Indicate items running low against a user-set threshold.

### 5. Grocery list
- Add a recipe's missing ingredients (and, optionally, shortfalls) to the list.
- Add manual items, optional quantities, and mark items purchased.
- Grocery items are separate from owned inventory.
- Later (P2): synchronized access from a phone.

## Priorities

### P0 — must work end to end by Dec 7
- Scan → confirm → match → full recipe view → guided cooking, with simulated scanning allowed before hardware
- Ingredient confirmation/editing UI
- Structured recipe schema with provenance, used by both recipe views
- Deterministic matching with missing-ingredient list and explained ranking; time filter
- Pi camera capture integrated with the backend once hardware arrives (labelled fallback otherwise)
- Automated API/matching tests, README setup, weekly logs

### P1 — target for the final demo; may be partial if clearly labelled
- Grocery list (recipe-missing + manual items, purchased status)
- Quantity-aware inventory with SQLite persistence
- Recipe-completion deductions with confirmation and undo
- Low-stock indicators
- Improved recommendation filtering (servings, simple preferences such as excluded ingredients)
- Real vision AI adapter with upload validation; one external recipe provider
- Physical touchscreen kiosk; step timers and error/retry states

### P2 — only if time remains
Voice controls, personalization/preference memory, multi-provider and creator-site recipe discovery, advanced substitutions, optional hardware sensors (e.g. scale), multi-device/phone synchronization, rating-aware ranking.

## Week 1 demo criteria (Nov 15)
- All five product areas are visible in the UI.
- Anything not backed by real functionality (scanning, inventory, grocery list) is labelled **SIMULATION / DEMO DATA** on screen.
- Recipe matching and guided cooking run against the real backend.

## Final demonstration criteria (Dec 7)
1. Raspberry Pi captures a real photo, OR the demo transparently falls back to a labelled upload/simulation.
2. Recognition returns structured candidates; the user edits/confirms them and can enter exact/estimated/no quantity. No prediction is treated as fact.
3. At least 3 seed or provider recipes ranked with matched/missing ingredients, time when known, and source attribution.
4. Time filter enforced; servings used for scaling only where quantities are known (otherwise informational).
5. At least one owned/authorized recipe shown in both full view and guided cooking mode from the same record.
6. P1 shown where ready (labelled if partial): confirmed ingredients saved to inventory; missing items added to grocery list; deduction preview → confirm → undo; low-stock indicator.
7. A reviewer can reproduce the demo from README; limitations recorded.

## Explicit non-goals
- Scraping arbitrary recipe websites; importing from creator sites without permission
- Automatic food safety, freshness, or expiry determination from photos
- Exact (or estimated) quantity detection from images — quantities come from the user
- Store inventory/price lookups, online ordering, or payments (the grocery list is a personal checklist)
- Mass↔volume unit conversion using density guesses
- Robotics, DIY battery or power electronics
- Hosting third-party full instructions without permission

## Product quality rules
- Never present an AI detection as certain before confirmation
- Never manufacture reviews, ratings, quantities, nutrition, or cooking times; missing stays `null`
- Inventory changes only after user confirmation; every change is logged and deductions are undoable
- Sources and instruction permissions tracked per recipe
- Missing ingredients explicit; ranking documented
- Demo mode works offline with seed recipes (after installation)
- Simulated features labelled in the UI
- Basic security/privacy and error handling

## Constraints
Solo student; roughly 40–60 hours total over 5 weeks (plan: 50). Demo Dec 7, final Dec 13. Hardware ceiling ~US$250. Spending approval and purchase remain the student's choice. The expanded scope makes P1 the cut line: P0 must be stable before P1 work begins.
