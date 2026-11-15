"""Derived low-stock status (SKH-15 logic; DATA_MODELS §5).

- out     — availability is OUT
- low     — quantity and threshold comparable and quantity <= threshold
- ok      — comparable and above threshold
- unknown — no threshold, unknown amount, or incompatible units
Pure and deterministic; inputs are not mutated and nothing is stored.
"""
from __future__ import annotations

from .models import Availability, InventoryRecord, StockStatus
from .quantities import amount_in, comparable, is_known


def stock_status(rec: InventoryRecord) -> StockStatus:
    def out(status: str, reason: str) -> StockStatus:
        return StockStatus(id=rec.id, display_name=rec.display_name, status=status, reason=reason)

    if rec.availability == Availability.OUT:
        return out("out", "Marked as used up")
    threshold = rec.low_stock_threshold
    if threshold is None:
        return out("unknown", "No low-stock threshold set")
    if not is_known(rec.quantity):
        return out("unknown", "Amount on hand is unknown")
    if not is_known(threshold):
        return out("unknown", "Threshold amount is unknown")
    if not comparable(rec.quantity, threshold):
        return out("unknown", f"Can't compare {rec.quantity.unit} with threshold in {threshold.unit}")
    assert threshold.unit is not None and threshold.amount is not None
    if amount_in(rec.quantity, threshold.unit) <= threshold.amount:
        return out("low", "At or below your low-stock threshold")
    return out("ok", "Above your low-stock threshold")


def stock_statuses(records: list[InventoryRecord]) -> list[StockStatus]:
    return [stock_status(r) for r in records]
