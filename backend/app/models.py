"""Pydantic v2 schemas for structured recipes, quantities, inventory records,
matching results, and deduction previews.

Follows docs/DATA_MODELS.md. Deviations are recorded in docs/DECISIONS.md
(ADR-016 to ADR-020).
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator

from .units import UNITS

# Upper bound on any single amount; rejects absurd input without guessing intent.
MAX_AMOUNT = Decimal("1000000")


# ---------------------------------------------------------------- quantities
class QuantityAccuracy(str, Enum):
    EXACT = "exact"          # measured, from a label, or stated by a recipe
    ESTIMATED = "estimated"  # user's approximation
    UNKNOWN = "unknown"      # skipped or not stated


class Quantity(BaseModel):
    """An amount + unit + how sure we are. Unknown stays unknown (amount=None)."""

    model_config = ConfigDict(extra="forbid")

    amount: Optional[Decimal] = Field(default=None, gt=0, le=MAX_AMOUNT)
    unit: Optional[str] = None
    accuracy: QuantityAccuracy
    display_text: Optional[str] = Field(default=None, max_length=80)

    @model_validator(mode="after")
    def _check_consistency(self) -> "Quantity":
        if self.accuracy == QuantityAccuracy.UNKNOWN and self.amount is not None:
            raise ValueError("accuracy 'unknown' requires amount to be null")
        if self.accuracy != QuantityAccuracy.UNKNOWN and self.amount is None:
            raise ValueError("an amount is required unless accuracy is 'unknown'")
        if self.unit is not None and self.unit not in UNITS:
            raise ValueError(f"unknown unit '{self.unit}'; expected one of {sorted(UNITS)}")
        if self.amount is not None and self.unit is None:
            raise ValueError("a unit is required when an amount is given")
        return self

    @classmethod
    def unknown(cls, display_text: Optional[str] = None) -> "Quantity":
        return cls(accuracy=QuantityAccuracy.UNKNOWN, display_text=display_text)


# ------------------------------------------------------------ ingredient catalog
class Ingredient(BaseModel):
    id: str
    name: str
    aliases: list[str] = []
    category: Optional[str] = None
    default_unit: Optional[str] = None
    is_staple: bool = False


# ------------------------------------------------------------------- recipes
class RecipeSource(BaseModel):
    provider: str
    provider_recipe_id: Optional[str] = None
    name: str
    url: Optional[HttpUrl] = None
    author: Optional[str] = None
    license_note: Optional[str] = None
    instruction_display_allowed: bool
    retrieved_at: Optional[datetime] = None
    is_sample_data: bool = False   # True for the project's original demo recipes


class RecipeRating(BaseModel):
    """Only ever populated from a provider. Never computed or defaulted."""

    value: float
    scale_max: float
    review_count: Optional[int] = None
    provider: str
    retrieved_at: datetime


class Substitution(BaseModel):
    replacement: str
    ingredient_id: Optional[str] = None
    note: Optional[str] = None


class RecipeIngredient(BaseModel):
    ingredient_id: Optional[str]
    display_name: str
    quantity: Quantity
    preparation: Optional[str] = None
    optional: bool = False
    group: Optional[str] = None
    substitutions: list[Substitution] = []


class RecipeStep(BaseModel):
    number: int = Field(ge=1)
    text: str
    ingredient_refs: list[str] = []
    timer_seconds: Optional[int] = Field(default=None, gt=0)
    safety_note: Optional[str] = None


class Recipe(BaseModel):
    id: str
    title: str
    source: RecipeSource
    servings: Optional[int] = Field(default=None, ge=1)
    prep_minutes: Optional[int] = Field(default=None, ge=0)
    cook_minutes: Optional[int] = Field(default=None, ge=0)
    total_minutes: Optional[int] = Field(default=None, ge=0)
    ingredients: list[RecipeIngredient]
    steps: list[RecipeStep]
    notes: list[str] = []
    safety_cautions: list[str] = []
    tags: list[str] = []
    rating: Optional[RecipeRating] = None

    @model_validator(mode="after")
    def _check_structure(self) -> "Recipe":
        if not self.ingredients:
            raise ValueError("a recipe needs at least one ingredient")
        numbers = [s.number for s in self.steps]
        if numbers != list(range(1, len(self.steps) + 1)):
            raise ValueError("steps must be numbered 1..n in order")
        if not self.source.instruction_display_allowed and self.steps:
            raise ValueError("steps must be empty when instruction display is not allowed")
        ids = [i.ingredient_id for i in self.ingredients if i.ingredient_id is not None]
        if len(ids) != len(set(ids)):
            raise ValueError("an ingredient_id may appear only once per recipe")
        known = set(ids)
        for step in self.steps:
            unknown_refs = set(step.ingredient_refs) - known
            if unknown_refs:
                raise ValueError(f"step {step.number} references ingredients not in the recipe: {sorted(unknown_refs)}")
        return self


# ----------------------------------------------------------------- inventory
class Availability(str, Enum):
    AVAILABLE = "available"
    OUT = "out"


class InventoryRecord(BaseModel):
    """An inventory item supplied by the client.

    There is no persistence yet (ADR-012), so the matching and deduction-preview
    endpoints receive inventory in the request body (ADR-017). Availability is
    independent of quantity (ADR-008).
    """

    model_config = ConfigDict(extra="forbid")

    id: Optional[str] = Field(default=None, min_length=1, max_length=64)
    ingredient_id: Optional[str] = Field(default=None, max_length=64)
    display_name: str = Field(min_length=1, max_length=80)
    availability: Availability = Availability.AVAILABLE
    quantity: Quantity = Field(default_factory=Quantity.unknown)
    low_stock_threshold: Optional[Quantity] = None   # user-set; used only by stock status
    location: Optional[str] = Field(default=None, max_length=40)


# ------------------------------------------------------------------ matching
CheckStatus = Literal[
    "have_enough",             # comparable and on hand >= required
    "have_unknown_amount",     # on hand, but recipe or inventory amount unknown
    "have_insufficient",       # comparable and on hand < required
    "have_incompatible_unit",  # on hand, units cannot be compared (e.g. g vs tsp)
    "assumed_staple",          # not in inventory; staple assumed on hand by request (ADR-018)
    "missing",
    "optional_missing",
]


class IngredientCheck(BaseModel):
    ingredient_id: Optional[str]
    display_name: str
    optional: bool = False
    status: CheckStatus
    required: Quantity
    on_hand: Optional[Quantity] = None
    shortfall: Optional[Quantity] = None   # only when comparable and insufficient


class RecipeMatch(BaseModel):
    recipe_id: str
    title: str
    source_name: str
    is_sample_data: bool
    total_minutes: Optional[int]
    servings: Optional[int]                 # as written by the recipe
    servings_requested: Optional[int] = None
    scale_factor: Optional[Decimal] = None  # None => amounts as written
    checks: list[IngredientCheck]
    match_pct: int                          # presence-based, required ingredients only
    missing: list[str]                      # required ingredients not on hand
    shortages: list[str]                    # on hand but less than required
    cannot_compare: list[str]               # on hand, amount unknown or units incompatible
    assumed_staples: list[str]
    rank_reasons: list[str]
    rating: Optional[RecipeRating] = None


class MatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    inventory: list[InventoryRecord] = Field(default_factory=list, max_length=200)
    assume_staples: bool = False
    max_minutes: Optional[int] = Field(default=None, ge=1, le=1440)
    servings: Optional[int] = Field(default=None, ge=1, le=30)


class MatchResponse(BaseModel):
    matches: list[RecipeMatch]
    unmapped_inventory: list[str]   # inventory names not in the catalog; kept, never dropped
    assume_staples: bool
    data_note: str


# ---------------------------------------------------------------- deductions
class DeductionLineStatus(str, Enum):
    WILL_DEDUCT = "will_deduct"
    WILL_DEDUCT_TO_ZERO = "will_deduct_to_zero"
    SKIP_RECIPE_AMOUNT_UNKNOWN = "skip_recipe_amount_unknown"
    SKIP_INVENTORY_AMOUNT_UNKNOWN = "skip_inventory_amount_unknown"
    SKIP_INCOMPATIBLE_UNITS = "skip_incompatible_units"
    SKIP_NOT_IN_INVENTORY = "skip_not_in_inventory"


class DeductionLine(BaseModel):
    ingredient_id: Optional[str]
    display_name: str
    inventory_item_id: Optional[str]
    required: Quantity                       # after scaling
    on_hand: Optional[Quantity] = None
    deduct: Optional[Quantity] = None        # None for SKIP_* lines
    resulting: Optional[Quantity] = None     # None when skipped or reaching zero
    proposed_availability: Optional[Availability] = None  # OUT when reaching zero
    status: DeductionLineStatus
    include: bool = True                     # optional ingredients default to False
    note: Optional[str] = None


class DeductionPreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    recipe_id: str = Field(min_length=1, max_length=100)
    servings_cooked: Optional[int] = Field(default=None, ge=1, le=30)
    inventory: list[InventoryRecord] = Field(default_factory=list, max_length=200)


class DeductionProposal(BaseModel):
    recipe_id: str
    preview_only: Literal[True] = True       # nothing is written (ADR-010)
    servings_cooked: Optional[int]
    scale_factor: Optional[Decimal]
    lines: list[DeductionLine]
    unmapped_inventory: list[str] = []
    warnings: list[str] = []
    created_at: datetime


# --------------------------------------------------------------- stock status
class UnitInfo(BaseModel):
    code: str
    dimension: str


class StockStatusRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    inventory: list[InventoryRecord] = Field(default_factory=list, max_length=200)


class StockStatus(BaseModel):
    """Derived, never stored (DATA_MODELS §5). `low`/`ok` only when comparable."""

    id: Optional[str]
    display_name: str
    status: Literal["out", "low", "ok", "unknown"]
    reason: str


# ------------------------------------------------- deduction apply / undo (ADR-025)
class QuantityState(BaseModel):
    """Snapshot of the fields a deduction changes."""

    quantity: Quantity
    availability: Availability


class DeductionBatchLine(BaseModel):
    inventory_item_id: str = Field(min_length=1, max_length=64)
    ingredient_id: Optional[str] = None
    display_name: str
    before: QuantityState
    after: QuantityState


class DeductionBatch(BaseModel):
    """What one confirmed cooking deduction changed; enough to undo it exactly."""

    id: str = Field(min_length=1, max_length=64)
    recipe_id: str = Field(min_length=1, max_length=100)
    servings_cooked: Optional[int] = None
    lines: list[DeductionBatchLine] = Field(max_length=100)
    created_at: datetime


class DeductionApplyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    recipe_id: str = Field(min_length=1, max_length=100)
    servings_cooked: Optional[int] = Field(default=None, ge=1, le=30)
    inventory: list[InventoryRecord] = Field(default_factory=list, max_length=200)
    # Lines the user confirmed, by ingredient_id (or display_name for unmapped ingredients).
    include: list[str] = Field(default_factory=list, max_length=100)


class NotApplied(BaseModel):
    display_name: str
    reason: str


class DeductionApplyResponse(BaseModel):
    inventory: list[InventoryRecord]   # full list, same order as the request
    batch: DeductionBatch
    applied: list[str]
    not_applied: list[NotApplied]


class DeductionUndoRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    batch: DeductionBatch
    inventory: list[InventoryRecord] = Field(default_factory=list, max_length=200)


class DeductionUndoResponse(BaseModel):
    inventory: list[InventoryRecord]
    restored: list[str]


# ------------------------------------------------------ quantity combine (ADR-026)
class QuantityPair(BaseModel):
    model_config = ConfigDict(extra="forbid")

    existing: Optional[Quantity] = None
    incoming: Optional[Quantity] = None


class QuantityCombineRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    pairs: list[QuantityPair] = Field(max_length=200)


class QuantityCombineResult(BaseModel):
    combinable: bool
    result: Optional[Quantity] = None   # only when combinable
    reason: str
