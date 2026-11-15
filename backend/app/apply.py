"""Apply and undo confirmed cooking deductions (SKH-14), and combine quantities.

Stateless until SQLite (ADR-017): the client sends its inventory, the server
recomputes the preview, applies only the lines the user confirmed, and returns
the updated records plus a batch snapshot. Undo restores the snapshot only if
every affected item still matches what the deduction produced (ADR-010/025).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from .deductions import preview_deduction
from .models import (
    Availability,
    DeductionApplyResponse,
    DeductionBatch,
    DeductionBatchLine,
    DeductionLineStatus,
    InventoryRecord,
    NotApplied,
    Quantity,
    QuantityCombineResult,
    QuantityState,
    Recipe,
)
from .quantities import amount_in, clean, combine_accuracy, comparable, is_known

DEDUCTIBLE = {DeductionLineStatus.WILL_DEDUCT, DeductionLineStatus.WILL_DEDUCT_TO_ZERO}

# After an item is used up the remaining amount is not invented: it becomes unknown.
USED_UP = Quantity(amount=None, unit=None, accuracy="unknown", display_text="used up")


class DeductionInputError(ValueError):
    """Request cannot be applied (HTTP 422)."""


class UndoConflictError(ValueError):
    """Inventory changed since the deduction; undo refused (HTTP 409)."""


def _key(ingredient_id: Optional[str], display_name: str) -> str:
    return ingredient_id or display_name


def apply_deduction(recipe: Recipe, records: list[InventoryRecord], servings_cooked: Optional[int],
                    include: list[str]) -> DeductionApplyResponse:
    proposal = preview_deduction(recipe, records, servings_cooked)
    wanted = set(include)
    by_id = {r.id: r for r in records if r.id is not None}
    changes: dict[str, QuantityState] = {}
    lines: list[DeductionBatchLine] = []
    applied: list[str] = []
    not_applied: list[NotApplied] = []

    for line in proposal.lines:
        if _key(line.ingredient_id, line.display_name) not in wanted:
            continue
        if line.status not in DEDUCTIBLE:
            not_applied.append(NotApplied(display_name=line.display_name, reason=line.note or line.status.value))
            continue
        if line.inventory_item_id is None or line.inventory_item_id not in by_id:
            raise DeductionInputError(f"inventory record for '{line.display_name}' needs an id to be deducted")
        rec = by_id[line.inventory_item_id]
        before = QuantityState(quantity=rec.quantity, availability=rec.availability)
        if line.status == DeductionLineStatus.WILL_DEDUCT:
            assert line.resulting is not None
            after = QuantityState(quantity=line.resulting, availability=Availability.AVAILABLE)
        else:
            after = QuantityState(quantity=USED_UP, availability=Availability.OUT)
        changes[rec.id] = after  # type: ignore[index]
        lines.append(DeductionBatchLine(inventory_item_id=rec.id, ingredient_id=line.ingredient_id,  # type: ignore[arg-type]
                                        display_name=line.display_name, before=before, after=after))
        applied.append(line.display_name)

    unknown = wanted - {_key(l.ingredient_id, l.display_name) for l in proposal.lines}
    not_applied += [NotApplied(display_name=k, reason="Not an ingredient of this recipe") for k in sorted(unknown)]

    updated = [
        r.model_copy(update={"quantity": changes[r.id].quantity, "availability": changes[r.id].availability})
        if r.id in changes else r
        for r in records
    ]
    batch = DeductionBatch(id=uuid.uuid4().hex, recipe_id=recipe.id, servings_cooked=servings_cooked,
                           lines=lines, created_at=datetime.now(timezone.utc))
    return DeductionApplyResponse(inventory=updated, batch=batch, applied=applied, not_applied=not_applied)


def undo_deduction(batch: DeductionBatch, records: list[InventoryRecord]) -> tuple[list[InventoryRecord], list[str]]:
    """Restore `before` snapshots. All-or-nothing: refused if any item changed since."""
    by_id = {r.id: r for r in records if r.id is not None}
    conflicts: list[str] = []
    for line in batch.lines:
        cur = by_id.get(line.inventory_item_id)
        if cur is None:
            conflicts.append(f"{line.display_name} (removed from My Kitchen)")
        elif cur.quantity != line.after.quantity or cur.availability != line.after.availability:
            conflicts.append(f"{line.display_name} (changed since cooking)")
    if conflicts:
        raise UndoConflictError("Can't undo: " + "; ".join(conflicts))
    restore = {l.inventory_item_id: l.before for l in batch.lines}
    restored = [
        r.model_copy(update={"quantity": restore[r.id].quantity, "availability": restore[r.id].availability})
        if r.id in restore else r
        for r in records
    ]
    return restored, [l.display_name for l in batch.lines]


def combine_quantities(existing: Optional[Quantity], incoming: Optional[Quantity]) -> QuantityCombineResult:
    """Sum two quantities only when both amounts are known and units are compatible.

    The result is expressed in the existing quantity's unit; accuracy is the less
    certain of the two. Anything else is reported as not combinable, never merged.
    """
    if not is_known(existing) or not is_known(incoming):
        return QuantityCombineResult(combinable=False, reason="An amount is unknown, so they can't be added together")
    if not comparable(existing, incoming):
        return QuantityCombineResult(combinable=False,
                                     reason=f"Units can't be combined ({existing.unit} and {incoming.unit})")  # type: ignore[union-attr]
    assert existing is not None and incoming is not None and existing.amount is not None and existing.unit is not None
    total = clean(existing.amount + amount_in(incoming, existing.unit))
    return QuantityCombineResult(
        combinable=True,
        result=Quantity(amount=total, unit=existing.unit, accuracy=combine_accuracy(existing.accuracy, incoming.accuracy)),
        reason="Added together",
    )
