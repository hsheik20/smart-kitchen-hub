# Data models — proposed (Nov 14, 2026)

**Status (updated Nov 14, 2026): partially implemented.** Sections 1–3 (quantities, catalog, recipes, recipe match) and the deduction *preview* models in §5 are implemented in `backend/app/models.py`. Scanning (§4), persisted inventory and transactions (§5), and grocery (§6) are still proposals. The legacy flat `RecipeResult` remains in `backend/app/main.py` as an adapter for the current UI (ADR-016).

**Implemented deviations from the proposal below** (see ADR-016–020):
- `RecipeSource.is_sample_data: bool` marks the project's original sample recipes.
- `IngredientCheck` adds `optional` and a status `assumed_staple` (opt-in, presence-only; ADR-018).
- `RecipeMatch` adds `is_sample_data`, `servings_requested`, `scale_factor`, and summary lists `missing`, `shortages`, `cannot_compare`, `assumed_staples`. `match_pct` counts required (non-optional) ingredients only.
- `InventoryRecord` (request-only, no timestamps) stands in for `InventoryItem` until SQLite (ADR-017). Its `quantity` defaults to unknown, never zero. It has an optional `low_stock_threshold` (added Nov 14, Phase 3), used only by `POST /api/inventory/stock-status`, which returns derived `StockStatus {id, display_name, status: out|low|ok|unknown, reason}`.
- The frontend's demo `InventoryItem` (browser localStorage, ADR-022) adds `id`, `created_at`, `updated_at` and is sent to the API without them.
- Nov 15 (ADR-025–027): `DeductionApplyRequest {recipe_id, servings_cooked, inventory, include}` → `DeductionApplyResponse {inventory, batch, applied, not_applied}`; `DeductionBatch {id, recipe_id, servings_cooked, lines[{inventory_item_id, ingredient_id, display_name, before, after}], created_at}` where `before`/`after` are `QuantityState {quantity, availability}` snapshots (stand-in for §5 transactions until SQLite). Used-up items get `availability: out` and an unknown quantity with `display_text: "used up"`. `QuantityCombineResult {combinable, result, reason}`.
- The browser `GroceryItem` follows §6 with `quantity` always present (accuracy `unknown` when no amount) and an extra `recipe_title`. The §6 merge rule is replaced by ADR-026 (incompatible amounts are kept as separate lines, not turned into unknown).
- `DeductionLine` adds `display_name`, `on_hand`, `proposed_availability`, `note`; skipped lines and optional ingredients default to `include: false`. `DeductionProposal` adds `preview_only`, `unmapped_inventory`, `warnings`.
- Decimal amounts serialize as JSON strings; reported amounts are rounded to 0.001 (ADR-019). The models below are the target for Pydantic v2 schemas (and, from P1, SQLite tables). Field names may change during implementation; record material changes in `DECISIONS.md`.

## Design rules
1. **Availability ≠ quantity.** Whether an ingredient is on hand is stored separately from how much there is and how sure we are.
2. **Unknown stays unknown.** `amount = None` is never turned into 0, 1, or a guess.
3. **Same-dimension units only.** Mass↔mass and volume↔volume conversions are allowed; mass↔volume (density) is not. Count-type units (each, clove, can) match only themselves.
4. **Inventory history is append-only.** Every change writes a transaction; undo writes a compensating transaction.
5. **Grocery items are not inventory.**
6. **Provenance on every recipe.** Ratings only from a provider; never computed or defaulted.
7. Use `Decimal` for amounts to avoid float drift across repeated deductions.

## 1. Shared types

### Units
```python
class UnitDimension(str, Enum):
    MASS = "mass"
    VOLUME = "volume"
    COUNT = "count"      # discrete, non-convertible between different count units
```
Initial canonical units (US customary volume):

| code | dimension | factor to base | base |
|---|---|---|---|
| `g`, `kg`, `oz`, `lb` | mass | 1, 1000, 28.3495, 453.592 | g |
| `ml`, `l`, `tsp`, `tbsp`, `cup`, `fl_oz` | volume | 1, 1000, 4.92892, 14.7868, 236.588, 29.5735 | ml |
| `each`, `clove`, `can`, `bunch`, `slice`, `package` | count | — | itself |

Phrases like "to taste", "a pinch", "a handful" are not units: they become `accuracy = unknown` with the original wording in `display_text`.

### Quantity
```python
class QuantityAccuracy(str, Enum):
    EXACT = "exact"          # measured, from a label, or stated by a recipe
    ESTIMATED = "estimated"  # user's approximation ("about half a bag")
    UNKNOWN = "unknown"      # skipped or not stated

class Quantity(BaseModel):
    amount: Decimal | None = None    # > 0 when present
    unit: str | None = None          # canonical unit code
    accuracy: QuantityAccuracy
    display_text: str | None = None  # original wording, e.g. "2 large", "to taste"
```
Validation:
- `accuracy == UNKNOWN` ⇔ `amount is None`.
- `amount` present ⇒ `amount > 0` and `unit` is a known code.

Arithmetic (comparison, subtraction, scaling):
- Only when both sides have amounts and units in the same dimension (count: identical unit).
- Result accuracy is the least certain input: exact + exact → exact; any estimated → estimated; any unknown → not computed.

## 2. Ingredient catalog
```python
class Ingredient(BaseModel):
    id: str                       # slug: "sweet-potato"
    name: str                     # "sweet potato"
    aliases: list[str] = []       # "sweet potatoes"
    category: str | None = None   # produce, protein, grain, pantry …
    default_unit: str | None = None
    is_staple: bool = False       # salt, oil, water — see open question on match %
```
Normalization (lowercase, collapse whitespace, alias lookup) maps any text to an `id` deterministically. Unmapped text is kept as a free-text name and flagged; it is never silently dropped.

## 3. Recipes

```python
class RecipeSource(BaseModel):
    provider: str                       # "seed" | "themealdb" | "creator-import"
    provider_recipe_id: str | None = None
    name: str                           # attribution shown to the user
    url: HttpUrl | None = None
    author: str | None = None
    license_note: str | None = None     # what use is permitted and why
    instruction_display_allowed: bool
    retrieved_at: datetime | None = None

class RecipeRating(BaseModel):          # only when the provider supplies it
    value: float
    scale_max: float
    review_count: int | None = None     # None ≠ 0
    provider: str
    retrieved_at: datetime

class Substitution(BaseModel):
    replacement: str
    ingredient_id: str | None = None
    note: str | None = None             # "texture will be softer"

class RecipeIngredient(BaseModel):
    ingredient_id: str | None           # None if unmapped (displayed, flagged in matching)
    display_name: str
    quantity: Quantity                  # "to taste" → accuracy UNKNOWN
    preparation: str | None = None      # "diced"
    optional: bool = False
    group: str | None = None            # "For the sauce"
    substitutions: list[Substitution] = []

class RecipeStep(BaseModel):
    number: int
    text: str
    ingredient_refs: list[str] = []     # ingredient_ids used here (cooking mode shows their quantities)
    timer_seconds: int | None = None    # only when the recipe states a duration
    safety_note: str | None = None      # e.g. "chicken to 165°F / 74°C"

class Recipe(BaseModel):
    id: str
    title: str
    source: RecipeSource
    servings: int | None = None
    prep_minutes: int | None = None
    cook_minutes: int | None = None
    total_minutes: int | None = None
    ingredients: list[RecipeIngredient]
    steps: list[RecipeStep]             # empty if display not allowed → UI links to source.url
    notes: list[str] = []
    safety_cautions: list[str] = []
    tags: list[str] = []                # dietary/cuisine tags for preference filters
    rating: RecipeRating | None = None
```
The full recipe view and guided cooking mode both render `Recipe`; neither has its own copy of the content.

### Recipe match (API response)
```python
class IngredientCheck(BaseModel):
    ingredient_id: str | None
    display_name: str
    status: Literal[
        "have_enough",          # comparable and on hand ≥ required
        "have_unknown_amount",  # on hand, but recipe or inventory amount unknown
        "have_insufficient",    # comparable and on hand < required
        "have_incompatible_unit",
        "missing",
        "optional_missing",
    ]
    required: Quantity
    on_hand: Quantity | None = None
    shortfall: Quantity | None = None   # only when comparable

class RecipeMatch(BaseModel):
    recipe_id: str
    title: str
    source_name: str
    total_minutes: int | None
    servings: int | None
    checks: list[IngredientCheck]
    match_pct: int                      # presence-based, deterministic
    rank_reasons: list[str]             # e.g. "all required ingredients on hand", "fits 45-min limit"
    rating: RecipeRating | None = None
```
Presence-based `match_pct` remains the primary ranking signal; quantity checks are shown to the user and may become a filter later.

## 4. Scanning
```python
class ScanSource(str, Enum):
    SIMULATED = "simulated"   # manual selection, labelled in UI
    UPLOAD = "upload"         # image file from Mac/phone
    PI_CAMERA = "pi_camera"

class IngredientCandidate(BaseModel):
    label: str                      # text returned by the source
    ingredient_id: str | None       # deterministic catalog lookup
    confidence: float | None = None # from the vision provider only; None for simulated

class ScanSession(BaseModel):
    id: str
    source: ScanSource
    status: Literal["pending", "ready", "failed", "confirmed"]
    candidates: list[IngredientCandidate]
    error: str | None = None
    created_at: datetime
    # no image bytes or file path retained after recognition (privacy default)

class ConfirmedIngredient(BaseModel):
    ingredient_id: str | None
    display_name: str
    quantity: Quantity              # UNKNOWN when the user skips
    from_candidate: bool            # False when the user added it manually
```

## 5. Inventory
```python
class Availability(str, Enum):
    AVAILABLE = "available"
    OUT = "out"                     # user marked used up, or a confirmed deduction reached zero

class InventoryItem(BaseModel):
    id: str
    ingredient_id: str | None
    display_name: str
    availability: Availability
    quantity: Quantity              # independent of availability
    low_stock_threshold: Quantity | None = None   # user-set; must be comparable to quantity
    location: str | None = None     # pantry / fridge / freezer (optional)
    created_at: datetime
    updated_at: datetime
```
Low-stock status is **derived, not stored**:
- `out` — availability is OUT
- `low` — quantity and threshold comparable and quantity ≤ threshold
- `ok` — comparable and above threshold
- `unknown` — no threshold, unknown quantity, or incompatible units

Estimated quantities display with "~" in the UI.

### Inventory transactions
```python
class TransactionType(str, Enum):
    ADD = "add"              # scan confirmation or manual add
    ADJUST = "adjust"        # manual correction (amount, unit, accuracy, availability)
    DEDUCT = "deduct"        # confirmed recipe deduction
    REVERSAL = "reversal"    # undo of another transaction

class InventoryTransaction(BaseModel):
    id: str
    inventory_item_id: str
    type: TransactionType
    quantity_before: Quantity
    quantity_after: Quantity
    availability_before: Availability
    availability_after: Availability
    batch_id: str | None = None      # groups the lines of one recipe deduction
    recipe_id: str | None = None
    reverses_id: str | None = None   # set on REVERSAL
    note: str | None = None
    created_at: datetime
```
Before/after snapshots (rather than only a delta) make undo exact and cover changes that are not numeric (accuracy, availability).

### Deduction workflow
```python
class DeductionLineStatus(str, Enum):
    WILL_DEDUCT = "will_deduct"
    WILL_DEDUCT_TO_ZERO = "will_deduct_to_zero"           # required > on hand; flagged for review
    SKIP_RECIPE_AMOUNT_UNKNOWN = "skip_recipe_amount_unknown"
    SKIP_INVENTORY_AMOUNT_UNKNOWN = "skip_inventory_amount_unknown"
    SKIP_INCOMPATIBLE_UNITS = "skip_incompatible_units"
    SKIP_NOT_IN_INVENTORY = "skip_not_in_inventory"

class DeductionLine(BaseModel):
    ingredient_id: str | None
    inventory_item_id: str | None
    required: Quantity               # after scaling
    deduct: Quantity | None          # None for SKIP_* lines
    resulting: Quantity | None
    status: DeductionLineStatus
    include: bool = True             # user may untick a line before confirming

class DeductionProposal(BaseModel):
    recipe_id: str
    servings_cooked: int | None
    scale_factor: Decimal | None     # servings_cooked / recipe.servings when both known, else None (amounts as written)
    lines: list[DeductionLine]
    created_at: datetime
```
Flow:
1. **Preview** — computes a proposal; writes nothing.
2. **Confirm** — the user reviews (can untick lines); included `WILL_DEDUCT*` lines are applied atomically as `DEDUCT` transactions sharing one `batch_id`. A line reaching zero proposes `availability = OUT`, which the user confirms.
3. **Undo** — writes one `REVERSAL` per transaction in the batch, restoring `quantity_before`/`availability_before`. Allowed only while no later transaction has touched those items (otherwise refused with an explanation).

Estimated inventory stays estimated after deduction; unknown is never deducted.

## 6. Grocery list
```python
class GroceryItemSource(str, Enum):
    RECIPE_MISSING = "recipe_missing"
    RECIPE_SHORTFALL = "recipe_shortfall"
    LOW_STOCK = "low_stock"
    MANUAL = "manual"

class GroceryListItem(BaseModel):
    id: str
    display_name: str
    ingredient_id: str | None = None   # None for free-text / non-food items
    quantity: Quantity | None = None
    purchased: bool = False
    purchased_at: datetime | None = None
    source: GroceryItemSource
    recipe_id: str | None = None
    note: str | None = None
    created_at: datetime
    updated_at: datetime
```
Rules:
- Adding an ingredient already on the list (unpurchased) merges into the existing line; quantities are summed only when comparable, otherwise the quantity becomes unknown with a note.
- Marking purchased never changes inventory. An optional "add to inventory" action (P1 enhancement) creates an `ADD` transaction only after the user confirms the quantity.

## 7. Storage plan (P1)
SQLite tables: `ingredients`, `recipes` (canonical JSON document + indexed columns), `inventory_items`, `inventory_transactions`, `grocery_items`, `scan_sessions` (no images). Database file lives under `backend/data/` and is git-ignored.

## 8. Migration from the current code
| Current (`RecipeResult` / `data.py`) | Target |
|---|---|
| `ingredients: list[str]` | `list[RecipeIngredient]`; seed recipes rewritten with real quantities (owner-authored) |
| `steps: list[str]` | `list[RecipeStep]` with `number`, optional `safety_note` |
| `source`, `source_url`, `author`, `instruction_display_allowed` | `RecipeSource` |
| `rating`, `review_count` | `RecipeRating | None` |
| `minutes` | `total_minutes` |
| `matched`, `missing`, `match_pct` mixed into the recipe | separate `RecipeMatch` response |
