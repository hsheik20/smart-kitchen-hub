"""Deterministic, quantity-aware recipe matching (SKH-04 / SKH-13 groundwork).

Presence-based `match_pct` is the primary ranking signal; quantity checks are
reported per ingredient. No AI is involved.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Optional

from .catalog import BY_ID
from .inventory import ResolvedInventory, resolve_inventory
from .models import (
    Availability,
    IngredientCheck,
    MatchRequest,
    MatchResponse,
    Recipe,
    RecipeIngredient,
    RecipeMatch,
)
from .quantities import clean, comparable, is_known, scale, shortfall

PRESENT = {"have_enough", "have_unknown_amount", "have_insufficient", "have_incompatible_unit", "assumed_staple"}

DATA_NOTE = (
    "Recipes are original sample data written for this project. Inventory is taken "
    "from this request only; nothing is stored. Ratings are unavailable."
)


def scale_factor(servings_wanted: Optional[int], recipe_servings: Optional[int]) -> Optional[Decimal]:
    """servings_wanted / recipe_servings when both are known, else None (amounts as written)."""
    if servings_wanted is None or recipe_servings is None:
        return None
    return Decimal(servings_wanted) / Decimal(recipe_servings)


def check_ingredient(
    ing: RecipeIngredient,
    inventory: ResolvedInventory,
    factor: Optional[Decimal],
    assume_staples: bool,
) -> IngredientCheck:
    required = scale(ing.quantity, factor)
    rec = inventory.find(ing)
    base = {"ingredient_id": ing.ingredient_id, "display_name": ing.display_name, "optional": ing.optional, "required": required}

    if rec is None or rec.availability == Availability.OUT:
        if ing.optional:
            return IngredientCheck(**base, status="optional_missing")
        staple = ing.ingredient_id is not None and BY_ID[ing.ingredient_id].is_staple
        if assume_staples and staple:
            return IngredientCheck(**base, status="assumed_staple")
        return IngredientCheck(**base, status="missing")

    on_hand = rec.quantity
    if not is_known(required) or not is_known(on_hand):
        return IngredientCheck(**base, status="have_unknown_amount", on_hand=on_hand)
    if not comparable(required, on_hand):
        return IngredientCheck(**base, status="have_incompatible_unit", on_hand=on_hand)
    short = shortfall(required, on_hand)
    if short is None:
        return IngredientCheck(**base, status="have_enough", on_hand=on_hand)
    return IngredientCheck(**base, status="have_insufficient", on_hand=on_hand, shortfall=short)


def _pct(part: int, whole: int) -> int:
    """Integer percentage, rounded half up."""
    if whole == 0:
        return 100
    return (part * 200 + whole) // (2 * whole)


def match_recipe(
    recipe: Recipe,
    inventory: ResolvedInventory,
    *,
    servings: Optional[int] = None,
    assume_staples: bool = False,
    max_minutes: Optional[int] = None,
) -> RecipeMatch:
    factor = scale_factor(servings, recipe.servings)
    checks = [check_ingredient(i, inventory, factor, assume_staples) for i in recipe.ingredients]
    required = [c for c in checks if not c.optional]

    missing = [c.display_name for c in required if c.status == "missing"]
    shortages = [c.display_name for c in required if c.status == "have_insufficient"]
    cannot = [c.display_name for c in required if c.status in ("have_unknown_amount", "have_incompatible_unit")]
    assumed = [c.display_name for c in required if c.status == "assumed_staple"]
    present = sum(1 for c in required if c.status in PRESENT)

    reasons: list[str] = []
    if not missing:
        reasons.append("All required ingredients on hand" + (" (some assumed staples)" if assumed else ""))
    else:
        reasons.append(f"Missing {len(missing)} required: {', '.join(missing)}")
    if shortages:
        reasons.append(f"Not enough: {', '.join(shortages)}")
    if cannot:
        reasons.append(f"Amount not compared (unknown amount or incompatible units): {', '.join(cannot)}")
    if not missing and not shortages and not cannot and not assumed:
        reasons.append("Enough of every required ingredient")
    if assumed:
        reasons.append(f"Assumed pantry staples (not in inventory): {', '.join(assumed)}")
    if max_minutes is not None:
        if recipe.total_minutes is None:
            reasons.append("Total time unknown; not filtered by time limit")
        else:
            reasons.append(f"Fits {max_minutes}-min limit ({recipe.total_minutes} min)")
    if servings is not None and factor is None:
        reasons.append("Recipe servings unknown; amounts shown as written")
    if recipe.source.is_sample_data:
        reasons.append("Original sample recipe (demo data)")

    return RecipeMatch(
        recipe_id=recipe.id,
        title=recipe.title,
        source_name=recipe.source.name,
        is_sample_data=recipe.source.is_sample_data,
        total_minutes=recipe.total_minutes,
        servings=recipe.servings,
        servings_requested=servings,
        scale_factor=clean(factor) if factor is not None else None,
        checks=checks,
        match_pct=_pct(present, len(required)),
        missing=missing,
        shortages=shortages,
        cannot_compare=cannot,
        assumed_staples=assumed,
        rank_reasons=reasons,
        rating=recipe.rating,
    )


def match_recipes(recipes: list[Recipe], request: MatchRequest) -> MatchResponse:
    inventory = resolve_inventory(request.inventory)
    matches = [
        match_recipe(r, inventory, servings=request.servings, assume_staples=request.assume_staples, max_minutes=request.max_minutes)
        for r in recipes
        if not (request.max_minutes is not None and r.total_minutes is not None and r.total_minutes > request.max_minutes)
    ]
    matches.sort(key=lambda m: (-m.match_pct, len(m.missing), len(m.shortages), m.total_minutes if m.total_minutes is not None else 10**6, m.title))
    return MatchResponse(
        matches=matches,
        unmapped_inventory=inventory.unmapped_names,
        assume_staples=request.assume_staples,
        data_note=DATA_NOTE,
    )
