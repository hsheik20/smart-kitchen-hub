import copy
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.catalog import INGREDIENTS, lookup_id
from app.data import RAW_RECIPES, RECIPES, load_recipes
from app.models import InventoryRecord, Quantity, QuantityAccuracy


# ------------------------------------------------------------- Quantity rules
def test_unknown_quantity_has_no_amount():
    q = Quantity(accuracy="unknown", display_text="to taste")
    assert q.amount is None and q.accuracy == QuantityAccuracy.UNKNOWN


@pytest.mark.parametrize("payload,fragment", [
    ({"amount": "1", "unit": "g", "accuracy": "unknown"}, "requires amount to be null"),
    ({"unit": "g", "accuracy": "exact"}, "amount is required"),
    ({"unit": "g", "accuracy": "estimated"}, "amount is required"),
    ({"amount": "0", "unit": "g", "accuracy": "exact"}, "greater than 0"),
    ({"amount": "-2", "unit": "g", "accuracy": "exact"}, "greater than 0"),
    ({"amount": "1", "unit": "pinch", "accuracy": "exact"}, "unknown unit"),
    ({"amount": "1", "accuracy": "exact"}, "unit is required"),
    ({"amount": "NaN", "unit": "g", "accuracy": "exact"}, ""),
    ({"amount": "5000000", "unit": "g", "accuracy": "exact"}, "less than or equal"),
    ({"amount": "1", "unit": "g", "accuracy": "roughly"}, ""),
    ({"amount": "1", "unit": "g", "accuracy": "exact", "extra": 1}, "Extra inputs"),
])
def test_quantity_rejects_invalid(payload, fragment):
    with pytest.raises(ValidationError) as exc:
        Quantity.model_validate(payload)
    assert fragment in str(exc.value)


def test_quantity_accepts_numbers_and_strings_as_decimal():
    assert Quantity.model_validate({"amount": 1.5, "unit": "cup", "accuracy": "estimated"}).amount == Decimal("1.5")
    assert Quantity.model_validate({"amount": "0.25", "unit": "tsp", "accuracy": "exact"}).amount == Decimal("0.25")


def test_inventory_record_defaults_to_unknown_quantity_not_zero():
    rec = InventoryRecord(display_name="rice")
    assert rec.quantity.amount is None
    assert rec.quantity.accuracy == QuantityAccuracy.UNKNOWN
    assert rec.availability.value == "available"


def test_inventory_record_validates_fields():
    with pytest.raises(ValidationError):
        InventoryRecord(display_name="")
    with pytest.raises(ValidationError):
        InventoryRecord.model_validate({"display_name": "rice", "availability": "maybe"})


# --------------------------------------------------------------- seed recipes
def test_seed_recipes_load_and_are_labelled_sample_data():
    assert len(RECIPES) == 4
    for r in RECIPES:
        assert r.source.is_sample_data is True
        assert r.source.provider == "seed"
        assert "sample" in r.source.name.lower()
        assert r.rating is None  # never fabricated
        assert r.safety_cautions, f"{r.id} has no safety cautions"
        assert r.notes
        assert all(s.timer_seconds is None for s in r.steps)


def test_seed_recipes_have_structured_quantities():
    for r in RECIPES:
        for ing in r.ingredients:
            if ing.quantity.accuracy == QuantityAccuracy.UNKNOWN:
                assert ing.quantity.display_text, "unknown amounts keep their original wording"
            else:
                assert ing.quantity.amount is not None and ing.quantity.unit is not None
    assert any(i.substitutions for r in RECIPES for i in r.ingredients)


def test_chicken_recipes_carry_temperature_caution():
    for r in RECIPES:
        if any(i.ingredient_id == "chicken" for i in r.ingredients):
            assert any("165°F" in c for c in r.safety_cautions)


def _bad(mutator):
    raw = copy.deepcopy(RAW_RECIPES[:1])
    mutator(raw[0])
    with pytest.raises(ValueError):
        load_recipes(raw)


def test_load_rejects_unknown_catalog_id():
    _bad(lambda r: r["ingredients"][0].update(ingredient_id="dragonfruit"))


def test_load_rejects_bad_step_numbering():
    _bad(lambda r: r["steps"][1].update(number=5))


def test_load_rejects_step_ref_not_in_recipe():
    _bad(lambda r: r["steps"][0].update(ingredient_refs=["onion"]))


def test_load_rejects_steps_when_display_not_allowed():
    _bad(lambda r: r.update(source={**r["source"], "instruction_display_allowed": False}))


def test_load_rejects_duplicate_ids():
    with pytest.raises(ValueError):
        load_recipes(copy.deepcopy(RAW_RECIPES[:1]) * 2)


# -------------------------------------------------------------------- catalog
def test_catalog_lookup_aliases_and_unmapped():
    assert lookup_id("  Sweet  Potatoes ") == "sweet-potato"
    assert lookup_id("Olive Oil") == "oil"
    assert lookup_id("sweet-potato") == "sweet-potato"
    assert lookup_id("tofu") is None


def test_catalog_marks_staples():
    staples = {i.id for i in INGREDIENTS if i.is_staple}
    assert {"salt", "oil"} <= staples
    assert "chicken" not in staples
