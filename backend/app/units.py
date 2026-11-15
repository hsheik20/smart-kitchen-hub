"""Canonical units and same-dimension conversion (ADR-009).

Pure functions over Decimal amounts and unit codes. No mass<->volume density
guesses; count units (each, clove, can, ...) convert only to themselves.
"""
from __future__ import annotations

from decimal import Decimal
from enum import Enum


class UnitDimension(str, Enum):
    MASS = "mass"
    VOLUME = "volume"
    COUNT = "count"


class IncompatibleUnitsError(ValueError):
    """Raised when two units cannot be converted between (different dimension or count units)."""


# code -> (dimension, factor to base unit). Base: g for mass, ml for volume.
# Count units have no factor: each is its own base.
UNITS: dict[str, tuple[UnitDimension, Decimal | None]] = {
    "g": (UnitDimension.MASS, Decimal("1")),
    "kg": (UnitDimension.MASS, Decimal("1000")),
    "oz": (UnitDimension.MASS, Decimal("28.3495")),
    "lb": (UnitDimension.MASS, Decimal("453.592")),
    "ml": (UnitDimension.VOLUME, Decimal("1")),
    "l": (UnitDimension.VOLUME, Decimal("1000")),
    "tsp": (UnitDimension.VOLUME, Decimal("4.92892")),
    "tbsp": (UnitDimension.VOLUME, Decimal("14.7868")),
    "cup": (UnitDimension.VOLUME, Decimal("236.588")),
    "fl_oz": (UnitDimension.VOLUME, Decimal("29.5735")),
    "each": (UnitDimension.COUNT, None),
    "clove": (UnitDimension.COUNT, None),
    "can": (UnitDimension.COUNT, None),
    "bunch": (UnitDimension.COUNT, None),
    "slice": (UnitDimension.COUNT, None),
    "package": (UnitDimension.COUNT, None),
}


def dimension(unit: str) -> UnitDimension:
    try:
        return UNITS[unit][0]
    except KeyError:
        raise ValueError(f"unknown unit '{unit}'") from None


def are_compatible(a: str, b: str) -> bool:
    """True when an amount in unit `a` can be expressed in unit `b`."""
    if a not in UNITS or b not in UNITS:
        return False
    dim_a, dim_b = UNITS[a][0], UNITS[b][0]
    if dim_a != dim_b:
        return False
    if dim_a == UnitDimension.COUNT:
        return a == b
    return True


def convert(amount: Decimal, from_unit: str, to_unit: str) -> Decimal:
    """Convert at full Decimal precision. Raises IncompatibleUnitsError otherwise."""
    if not are_compatible(from_unit, to_unit):
        raise IncompatibleUnitsError(f"cannot convert {from_unit} to {to_unit}")
    if from_unit == to_unit:
        return amount
    from_factor = UNITS[from_unit][1]
    to_factor = UNITS[to_unit][1]
    assert from_factor is not None and to_factor is not None
    return amount * from_factor / to_factor
