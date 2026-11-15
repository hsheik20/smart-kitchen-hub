from decimal import Decimal

from app.data import RECIPES_BY_ID
from app.deductions import preview_deduction
from app.models import DeductionLineStatus as S
from app.models import InventoryRecord

BOWL = RECIPES_BY_ID["chicken-rice-bowl"]
SHEET = RECIPES_BY_ID["sheet-pan-chicken"]


def inv(rid, name, amount=None, unit=None, accuracy="exact", **kw):
    quantity = {"accuracy": "unknown"} if amount is None else {"amount": amount, "unit": unit, "accuracy": accuracy}
    return InventoryRecord.model_validate({"id": rid, "display_name": name, "quantity": quantity, **kw})


def line(proposal, ingredient_id):
    return next(l for l in proposal.lines if l.ingredient_id == ingredient_id)


def test_will_deduct_converts_into_inventory_unit():
    p = preview_deduction(BOWL, [inv("i1", "oil", "1", "cup")], None)
    l = line(p, "oil")
    assert l.status == S.WILL_DEDUCT and l.include
    assert l.inventory_item_id == "i1"
    assert (l.deduct.amount, l.deduct.unit) == (Decimal("0.063"), "cup")   # 1 tbsp, rounded up
    assert (l.resulting.amount, l.resulting.unit) == (Decimal("0.937"), "cup")
    assert l.proposed_availability.value == "available"


def test_estimated_inventory_stays_estimated():
    l = line(preview_deduction(BOWL, [inv("i1", "chicken", "1", "kg", accuracy="estimated")], None), "chicken")
    assert l.resulting.amount == Decimal("0.7") and l.resulting.accuracy.value == "estimated"


def test_insufficient_deducts_to_zero_and_flags_review():
    l = line(preview_deduction(BOWL, [inv("i1", "chicken", "200", "g")], None), "chicken")
    assert l.status == S.WILL_DEDUCT_TO_ZERO
    assert l.deduct.amount == Decimal("200") and l.resulting is None
    assert l.proposed_availability.value == "out"
    assert "review" in l.note.lower()


def test_exact_use_of_all_stock():
    l = line(preview_deduction(BOWL, [inv("i1", "zucchini", "1", "each")], None), "zucchini")
    assert l.status == S.WILL_DEDUCT_TO_ZERO and l.proposed_availability.value == "out"
    assert l.note.startswith("Uses all remaining stock")


def test_skip_reasons():
    p = preview_deduction(BOWL, [inv("i1", "salt", "500", "g"), inv("i2", "rice"), inv("i3", "oil", "10", "g")], None)
    assert line(p, "salt").status == S.SKIP_RECIPE_AMOUNT_UNKNOWN      # recipe: to taste
    assert line(p, "rice").status == S.SKIP_INVENTORY_AMOUNT_UNKNOWN   # inventory amount unknown
    assert line(p, "oil").status == S.SKIP_INCOMPATIBLE_UNITS          # tbsp vs g: no density guess
    assert line(p, "chicken").status == S.SKIP_NOT_IN_INVENTORY
    for iid in ("salt", "rice", "oil", "chicken", "zucchini"):
        l = line(p, iid)
        assert l.deduct is None and l.resulting is None and l.include is False


def test_out_of_stock_item_is_skipped():
    l = line(preview_deduction(BOWL, [inv("i1", "rice", "1", "kg", availability="out")], None), "rice")
    assert l.status == S.SKIP_NOT_IN_INVENTORY and l.inventory_item_id == "i1"


def test_scaling_by_servings_cooked():
    p = preview_deduction(BOWL, [inv("i1", "chicken", "1", "lb")], 3)
    l = line(p, "chicken")
    assert p.scale_factor == Decimal("1.5")
    assert l.required.amount == Decimal("450")
    assert (l.deduct.amount, l.resulting.amount) == (Decimal("0.993"), Decimal("0.007"))


def test_optional_ingredient_not_included_by_default():
    l = line(preview_deduction(SHEET, [inv("i1", "black pepper", "50", "g")], None), "black-pepper")
    assert l.status == S.SKIP_INCOMPATIBLE_UNITS  # tsp vs g
    l = line(preview_deduction(SHEET, [inv("i1", "black pepper", "100", "ml")], None), "black-pepper")
    assert l.status == S.WILL_DEDUCT and l.include is False


def test_preview_writes_nothing_and_does_not_mutate_input():
    records = [inv("i1", "chicken", "1", "kg"), inv("i2", "oil", "500", "ml")]
    snapshot = [r.model_copy(deep=True) for r in records]
    first = preview_deduction(BOWL, records, 2)
    second = preview_deduction(BOWL, records, 2)
    assert records == snapshot
    assert first.preview_only is True
    assert first.model_dump(exclude={"created_at"}) == second.model_dump(exclude={"created_at"})


def test_sample_data_warning_present():
    assert any("sample" in w.lower() for w in preview_deduction(BOWL, [], None).warnings)
