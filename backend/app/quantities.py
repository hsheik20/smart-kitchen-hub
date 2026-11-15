"""Deterministic arithmetic on Quantity values (comparison, shortfall, scaling).

Rules (docs/DATA_MODELS.md §1, ADR-008/009/019):
- Only quantities with amounts and compatible units are compared or subtracted.
- Result accuracy is the least certain input (exact+exact -> exact, any
  estimated -> estimated). Unknown inputs are never computed with.
- Comparisons use full Decimal precision; reported amounts are rounded to
  0.001 of their unit. Shortfalls and deductions round *up* so a real shortfall
  never displays as zero and remaining stock is never overstated.
"""
from __future__ import annotations

from decimal import ROUND_CEILING, ROUND_HALF_UP, Decimal
from typing import Optional

from .models import Quantity, QuantityAccuracy
from .units import are_compatible, convert

REPORT_STEP = Decimal("0.001")


def clean(amount: Decimal, rounding: str = ROUND_HALF_UP) -> Decimal:
    """Round to REPORT_STEP and strip trailing zeros without scientific notation."""
    q = amount.quantize(REPORT_STEP, rounding=rounding)
    if q == q.to_integral_value():
        return q.quantize(Decimal(1))
    return q.normalize()


def combine_accuracy(*values: QuantityAccuracy) -> QuantityAccuracy:
    if any(v == QuantityAccuracy.UNKNOWN for v in values):
        return QuantityAccuracy.UNKNOWN
    if any(v == QuantityAccuracy.ESTIMATED for v in values):
        return QuantityAccuracy.ESTIMATED
    return QuantityAccuracy.EXACT


def is_known(q: Optional[Quantity]) -> bool:
    return q is not None and q.amount is not None and q.unit is not None


def comparable(a: Optional[Quantity], b: Optional[Quantity]) -> bool:
    return is_known(a) and is_known(b) and are_compatible(a.unit, b.unit)  # type: ignore[union-attr,arg-type]


def amount_in(q: Quantity, unit: str) -> Decimal:
    """Full-precision amount of `q` expressed in `unit` (must be comparable)."""
    assert q.amount is not None and q.unit is not None
    return convert(q.amount, q.unit, unit)


def scale(q: Quantity, factor: Optional[Decimal]) -> Quantity:
    """Scale a recipe quantity. Unknown stays unknown; factor None/1 returns it unchanged.

    The original display_text (e.g. "1 medium") no longer describes a scaled
    amount, so it is dropped when the amount changes.
    """
    if factor is None or factor == 1 or q.amount is None:
        return q
    # Never let rounding turn a real requirement into zero.
    amount = max(clean(q.amount * factor), REPORT_STEP)
    return Quantity(amount=amount, unit=q.unit, accuracy=q.accuracy)


def shortfall(required: Quantity, on_hand: Quantity) -> Optional[Quantity]:
    """Amount still needed, in the recipe's unit; None when on hand covers it.

    Caller must ensure the two quantities are comparable.
    """
    assert required.unit is not None and required.amount is not None
    have = amount_in(on_hand, required.unit)
    if have >= required.amount:
        return None
    return Quantity(
        amount=clean(required.amount - have, ROUND_CEILING),
        unit=required.unit,
        accuracy=combine_accuracy(required.accuracy, on_hand.accuracy),
    )


def converted(q: Quantity, unit: str, rounding: str = ROUND_HALF_UP) -> Quantity:
    """Express a known quantity in another compatible unit, keeping its accuracy."""
    return Quantity(amount=clean(amount_in(q, unit), rounding), unit=unit, accuracy=q.accuracy)
