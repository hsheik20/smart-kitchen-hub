"""Ingredient catalog and deterministic name normalization.

Covers only the ingredients used by the original sample recipes plus a few
common staples. Unmapped text is reported back to the caller, never dropped.
"""
from __future__ import annotations

from typing import Optional

from .models import Ingredient

INGREDIENTS: list[Ingredient] = [
    Ingredient(id="chicken", name="chicken", aliases=["chicken breast", "chicken breasts", "boneless chicken breast", "chicken thigh", "chicken thighs"], category="protein", default_unit="g"),
    Ingredient(id="rice", name="rice", aliases=["white rice", "long-grain white rice", "long grain rice"], category="grain", default_unit="g"),
    Ingredient(id="zucchini", name="zucchini", aliases=["zucchinis", "courgette", "courgettes"], category="produce", default_unit="each"),
    Ingredient(id="sweet-potato", name="sweet potato", aliases=["sweet potatoes", "yam", "yams"], category="produce", default_unit="each"),
    Ingredient(id="garlic", name="garlic", aliases=["garlic clove", "garlic cloves"], category="produce", default_unit="clove"),
    Ingredient(id="onion", name="onion", aliases=["onions", "yellow onion", "yellow onions"], category="produce", default_unit="each"),
    Ingredient(id="oil", name="oil", aliases=["olive oil", "vegetable oil", "cooking oil", "neutral oil"], category="pantry", default_unit="ml", is_staple=True),
    Ingredient(id="salt", name="salt", aliases=["table salt", "kosher salt", "sea salt"], category="pantry", default_unit="g", is_staple=True),
    Ingredient(id="black-pepper", name="black pepper", aliases=["ground black pepper"], category="pantry", default_unit="g", is_staple=True),
    Ingredient(id="water", name="water", aliases=[], category="pantry", default_unit="ml", is_staple=True),
]

BY_ID: dict[str, Ingredient] = {i.id: i for i in INGREDIENTS}


def clean_text(value: str) -> str:
    """Lowercase and collapse whitespace."""
    return " ".join(value.strip().lower().split())


def _build_lookup() -> dict[str, str]:
    lookup: dict[str, str] = {}
    for ing in INGREDIENTS:
        for key in [ing.id, ing.name, *ing.aliases]:
            k = clean_text(key)
            if k in lookup and lookup[k] != ing.id:
                raise ValueError(f"catalog alias '{k}' maps to both {lookup[k]} and {ing.id}")
            lookup[k] = ing.id
            lookup[k.replace("-", " ")] = ing.id
    return lookup


_LOOKUP = _build_lookup()


def lookup_id(text: str) -> Optional[str]:
    """Map free text to a catalog id, or None if unmapped."""
    return _LOOKUP.get(clean_text(text))


def is_known_id(ingredient_id: str) -> bool:
    return ingredient_id in BY_ID
