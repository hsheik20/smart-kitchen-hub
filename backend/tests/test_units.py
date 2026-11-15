from decimal import Decimal

import pytest

from app.models import Quantity, QuantityAccuracy
from app.quantities import clean, combine_accuracy, comparable, scale, shortfall
from app.units import UNITS, IncompatibleUnitsError, are_compatible, convert

E, EST, U = QuantityAccuracy.EXACT, QuantityAccuracy.ESTIMATED, QuantityAccuracy.UNKNOWN


def q(amount, unit, accuracy=E):
    return Quantity(amount=Decimal(amount), unit=unit, accuracy=accuracy)


@pytest.mark.parametrize("amount,src,dst,expected", [
    ("1", "kg", "g", "1000"),
    ("1", "lb", "g", "453.592"),
    ("1", "lb", "oz", "16.000"),
    ("1", "cup", "ml", "236.588"),
    ("1", "tbsp", "tsp", "3.000"),
    ("2", "l", "cup", "8.454"),
    ("3", "clove", "clove", "3"),
])
def test_convert_same_dimension(amount, src, dst, expected):
    assert clean(convert(Decimal(amount), src, dst)) == Decimal(expected)


@pytest.mark.parametrize("src,dst", [
    ("g", "ml"), ("cup", "g"), ("tsp", "oz"),     # mass <-> volume: no density guesses
    ("each", "g"), ("clove", "each"), ("can", "package"),  # count units only match themselves
])
def test_convert_incompatible_raises(src, dst):
    assert not are_compatible(src, dst)
    with pytest.raises(IncompatibleUnitsError):
        convert(Decimal(1), src, dst)


def test_unknown_unit_is_not_compatible():
    assert not are_compatible("pinch", "g")
    assert "pinch" not in UNITS


def test_round_trip_is_stable():
    amount = Decimal("2.5")
    assert clean(convert(convert(amount, "cup", "ml"), "ml", "cup")) == amount


def test_accuracy_propagation():
    assert combine_accuracy(E, E) == E
    assert combine_accuracy(E, EST) == EST
    assert combine_accuracy(EST, U) == U


def test_shortfall_across_units_rounds_up():
    # Need 1 cup (236.588 ml), have 236.5 ml: real but tiny shortfall must not show as 0.
    sf = shortfall(q("1", "cup"), q("236.5", "ml"))
    assert sf is not None and sf.amount == Decimal("0.001") and sf.unit == "cup"


def test_shortfall_none_when_enough_and_accuracy_combined():
    assert shortfall(q("300", "g"), q("1", "lb")) is None
    sf = shortfall(q("300", "g"), q("0.5", "lb", EST))
    assert sf.amount == Decimal("73.204") and sf.accuracy == EST


def test_comparable_requires_known_amounts():
    assert comparable(q("1", "tbsp"), q("1", "cup"))
    assert not comparable(q("1", "tbsp"), q("1", "g"))
    assert not comparable(q("1", "tbsp"), Quantity.unknown())


def test_scale_keeps_unknown_unknown():
    unknown = Quantity.unknown("to taste")
    assert scale(unknown, Decimal(2)) == unknown


def test_scale_drops_stale_display_text_and_never_hits_zero():
    scaled = scale(Quantity(amount=Decimal(1), unit="each", accuracy=E, display_text="1 medium"), Decimal("1.5"))
    assert scaled.amount == Decimal("1.5") and scaled.display_text is None
    tiny = scale(q("0.001", "g"), Decimal(1) / Decimal(30))
    assert tiny.amount == Decimal("0.001")
