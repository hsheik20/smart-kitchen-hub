"""Recipe-completion deduction *preview* (SKH-14, preview half only).

Computes what a confirmed deduction would do. Writes nothing and never
mutates the inventory it is given (ADR-010). Confirm/undo come with SQLite.
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import ROUND_CEILING, ROUND_FLOOR, Decimal
from typing import Optional

from .inventory import ResolvedInventory, resolve_inventory
from .matching import scale_factor
from .models import (
    Availability,
    DeductionLine,
    DeductionLineStatus,
    DeductionProposal,
    InventoryRecord,
    Quantity,
    Recipe,
    RecipeIngredient,
)
from .quantities import amount_in, clean, combine_accuracy, comparable, is_known, scale

S = DeductionLineStatus


def preview_line(ing: RecipeIngredient, inventory: ResolvedInventory, factor: Optional[Decimal]) -> DeductionLine:
    required = scale(ing.quantity, factor)
    rec = inventory.find(ing)
    base = {
        "ingredient_id": ing.ingredient_id,
        "display_name": ing.display_name,
        "required": required,
        # Optional ingredients may not have been used; the user opts in.
        "include": not ing.optional,
    }
    optional_note = "Optional ingredient: include only if you used it." if ing.optional else None

    if rec is None or rec.availability == Availability.OUT:
        return DeductionLine(**(base | {"include": False}), inventory_item_id=rec.id if rec else None,
                             on_hand=rec.quantity if rec else None, status=S.SKIP_NOT_IN_INVENTORY,
                             note="Not in inventory (or marked out).")

    on_hand = rec.quantity
    common = {**base, "inventory_item_id": rec.id, "on_hand": on_hand}
    if not is_known(required):
        return DeductionLine(**(common | {"include": False}), status=S.SKIP_RECIPE_AMOUNT_UNKNOWN,
                             note="Recipe amount is not stated; nothing will be deducted.")
    if not is_known(on_hand):
        return DeductionLine(**(common | {"include": False}), status=S.SKIP_INVENTORY_AMOUNT_UNKNOWN,
                             note="Inventory amount is unknown; update it manually if needed.")
    if not comparable(required, on_hand):
        return DeductionLine(**(common | {"include": False}), status=S.SKIP_INCOMPATIBLE_UNITS,
                             note=f"Cannot convert {required.unit} to {on_hand.unit}; no density guesses are made.")

    assert on_hand.unit is not None and on_hand.amount is not None
    accuracy = combine_accuracy(required.accuracy, on_hand.accuracy)
    # Express the requirement in the inventory's unit, rounded up so remaining
    # stock is never overstated.
    need = clean(amount_in(required, on_hand.unit), ROUND_CEILING)

    remaining = clean(on_hand.amount - need, ROUND_FLOOR) if need < on_hand.amount else Decimal(0)
    if remaining > 0:
        return DeductionLine(
            **common,
            deduct=Quantity(amount=need, unit=on_hand.unit, accuracy=required.accuracy),
            resulting=Quantity(amount=remaining, unit=on_hand.unit, accuracy=accuracy),
            proposed_availability=Availability.AVAILABLE,
            status=S.WILL_DEDUCT,
            note=optional_note,
        )

    reason = "Uses all remaining stock." if need <= on_hand.amount else (
        "Recipe needs more than inventory shows; deducting to zero. Please review.")
    return DeductionLine(
        **common,
        deduct=Quantity(amount=on_hand.amount, unit=on_hand.unit, accuracy=on_hand.accuracy),
        resulting=None,
        proposed_availability=Availability.OUT,
        status=S.WILL_DEDUCT_TO_ZERO,
        note=" ".join(n for n in (reason, optional_note) if n),
    )


def preview_deduction(recipe: Recipe, inventory_records: list[InventoryRecord], servings_cooked: Optional[int]) -> DeductionProposal:
    inventory = resolve_inventory(inventory_records)
    factor = scale_factor(servings_cooked, recipe.servings)
    warnings: list[str] = []
    if servings_cooked is not None and factor is None:
        warnings.append("Recipe servings are unknown; amounts are as written, not scaled.")
    if recipe.source.is_sample_data:
        warnings.append("Original sample recipe: quantities are illustrative demo data.")
    return DeductionProposal(
        recipe_id=recipe.id,
        servings_cooked=servings_cooked,
        scale_factor=clean(factor) if factor is not None else None,
        lines=[preview_line(i, inventory, factor) for i in recipe.ingredients],
        unmapped_inventory=inventory.unmapped_names,
        warnings=warnings,
        created_at=datetime.now(timezone.utc),
    )
