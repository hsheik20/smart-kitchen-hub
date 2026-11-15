"""Resolve client-supplied inventory records to catalog ingredients.

Shared by matching and deduction preview. Pure: inputs are never mutated.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from .catalog import clean_text, is_known_id, lookup_id
from .models import InventoryRecord, RecipeIngredient


class InventoryInputError(ValueError):
    """Client inventory cannot be interpreted unambiguously (reported as HTTP 422)."""


@dataclass
class ResolvedInventory:
    by_ingredient_id: dict[str, InventoryRecord] = field(default_factory=dict)
    by_unmapped_name: dict[str, InventoryRecord] = field(default_factory=dict)

    @property
    def unmapped_names(self) -> list[str]:
        return sorted(r.display_name for r in self.by_unmapped_name.values())

    def find(self, ing: RecipeIngredient) -> Optional[InventoryRecord]:
        if ing.ingredient_id is not None:
            return self.by_ingredient_id.get(ing.ingredient_id)
        return self.by_unmapped_name.get(clean_text(ing.display_name))


def resolve_inventory(records: list[InventoryRecord]) -> ResolvedInventory:
    """Map each record to a catalog id (explicit id first, then name lookup).

    Unmapped names are kept (and reported), never dropped. Two records for the
    same ingredient are rejected: without persistence there is no rule for
    which one a deduction should come from (ADR-017).
    """
    out = ResolvedInventory()
    seen_record_ids: set[str] = set()
    for rec in records:
        if rec.id is not None:
            if rec.id in seen_record_ids:
                raise InventoryInputError(f"duplicate inventory record id '{rec.id}'")
            seen_record_ids.add(rec.id)
        if rec.ingredient_id is not None:
            if not is_known_id(rec.ingredient_id):
                raise InventoryInputError(f"unknown ingredient_id '{rec.ingredient_id}'; see GET /api/ingredients")
            ing_id: Optional[str] = rec.ingredient_id
        else:
            ing_id = lookup_id(rec.display_name)
        if ing_id is not None:
            if ing_id in out.by_ingredient_id:
                raise InventoryInputError(f"more than one inventory record for ingredient '{ing_id}'")
            out.by_ingredient_id[ing_id] = rec
        else:
            key = clean_text(rec.display_name)
            if key in out.by_unmapped_name:
                raise InventoryInputError(f"more than one inventory record named '{rec.display_name}'")
            out.by_unmapped_name[key] = rec
    return out
