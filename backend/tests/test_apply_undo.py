from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.apply import UndoConflictError, apply_deduction, combine_quantities, undo_deduction
from app.data import RECIPES_BY_ID
from app.main import app
from app.models import InventoryRecord, Quantity

client = TestClient(app)
BOWL = RECIPES_BY_ID["chicken-rice-bowl"]   # chicken 300 g, rice 150 g, zucchini 1, oil 1 tbsp, salt to taste
SHEET = RECIPES_BY_ID["sheet-pan-chicken"]  # includes optional black pepper


def rec(rid, name, amount=None, unit=None, accuracy="exact", **kw):
    q = {"accuracy": "unknown"} if amount is None else {"amount": amount, "unit": unit, "accuracy": accuracy}
    return InventoryRecord.model_validate({"id": rid, "display_name": name, "quantity": q, **kw})


def q(amount, unit, accuracy="exact"):
    return Quantity(amount=Decimal(amount), unit=unit, accuracy=accuracy)


def by_id(records):
    return {r.id: r for r in records}


KITCHEN = [
    rec("c", "chicken", "1", "lb"),                      # enough (453.592 g)
    rec("r", "rice", "2", "cup"),                        # incompatible: recipe uses grams
    rec("z", "zucchini", "1", "each"),                   # exactly enough -> used up
    rec("o", "oil", "500", "ml", accuracy="estimated"),  # enough, estimated
    rec("s", "salt"),                                    # unknown amount; recipe says "to taste"
    rec("t", "tofu", "1", "package", location="fridge"), # not in recipe
]
ALL = ["chicken", "rice", "zucchini", "oil", "salt"]


# ------------------------------------------------------------------- apply
def test_apply_deducts_only_safe_lines_and_preserves_others():
    res = apply_deduction(BOWL, KITCHEN, None, ALL)
    inv = by_id(res.inventory)
    assert [r.id for r in res.inventory] == [r.id for r in KITCHEN]          # order kept, nothing dropped
    assert inv["c"].quantity == q("0.338", "lb")                             # 1 lb - 300 g (0.662 lb, deduction rounded up)
    assert inv["o"].quantity == q("485.213", "ml", "estimated")              # estimated stays estimated
    assert inv["r"] == KITCHEN[1]                                            # incompatible: untouched
    assert inv["s"] == KITCHEN[4] and inv["s"].quantity.amount is None       # unknown never guessed
    assert inv["t"] == KITCHEN[5]                                            # unrelated item untouched
    assert sorted(res.applied) == ["boneless chicken breast", "cooking oil", "zucchini"]
    reasons = {n.display_name: n.reason for n in res.not_applied}
    assert "no density" in reasons["long-grain white rice"]
    assert "not stated" in reasons["salt"]


def test_reaching_zero_marks_used_up_with_unknown_amount_not_zero_or_negative():
    inv = by_id(apply_deduction(BOWL, KITCHEN, None, ["zucchini"]).inventory)
    assert inv["z"].availability.value == "out"
    assert inv["z"].quantity.amount is None and inv["z"].quantity.accuracy.value == "unknown"


def test_insufficient_stock_goes_to_used_up_never_negative():
    res = apply_deduction(BOWL, [rec("c", "chicken", "100", "g")], 3, ["chicken"])  # needs 450 g
    c = res.inventory[0]
    assert c.availability.value == "out" and c.quantity.amount is None
    assert res.batch.lines[0].before.quantity == q("100", "g")


def test_only_confirmed_lines_are_applied():
    res = apply_deduction(BOWL, KITCHEN, None, ["oil"])
    inv = by_id(res.inventory)
    assert inv["c"] == KITCHEN[0] and inv["z"] == KITCHEN[2]
    assert res.applied == ["cooking oil"] and len(res.batch.lines) == 1


def test_scaling_applies_to_deductions():
    res = apply_deduction(BOWL, [rec("c", "chicken", "1", "kg")], 4, ["chicken"])  # 600 g
    assert res.inventory[0].quantity == q("0.4", "kg")


def test_optional_ingredient_only_when_included():
    pepper = [rec("p", "black pepper", "100", "ml")]
    assert apply_deduction(SHEET, pepper, None, []).inventory[0] == pepper[0]
    assert apply_deduction(SHEET, pepper, None, ["black-pepper"]).inventory[0].quantity.amount < Decimal(100)


def test_missing_and_unknown_includes_reported():
    res = apply_deduction(BOWL, [], None, ["chicken", "dragonfruit"])
    reasons = {n.display_name: n.reason for n in res.not_applied}
    assert "Not in inventory" in reasons["boneless chicken breast"]
    assert reasons["dragonfruit"] == "Not an ingredient of this recipe"
    assert res.batch.lines == []


def test_apply_does_not_mutate_input():
    snapshot = [r.model_copy(deep=True) for r in KITCHEN]
    apply_deduction(BOWL, KITCHEN, 2, ALL)
    assert KITCHEN == snapshot


# -------------------------------------------------------------------- undo
def test_undo_restores_exact_snapshots():
    res = apply_deduction(BOWL, KITCHEN, None, ALL)
    restored, names = undo_deduction(res.batch, res.inventory)
    assert restored == KITCHEN
    assert sorted(names) == ["boneless chicken breast", "cooking oil", "zucchini"]


def test_undo_refused_after_later_change():
    res = apply_deduction(BOWL, KITCHEN, None, ALL)
    edited = [r.model_copy(update={"quantity": q("2", "lb")}) if r.id == "c" else r for r in res.inventory]
    with pytest.raises(UndoConflictError, match="boneless chicken breast"):
        undo_deduction(res.batch, edited)


def test_undo_refused_when_item_removed():
    res = apply_deduction(BOWL, KITCHEN, None, ["oil"])
    with pytest.raises(UndoConflictError, match="removed"):
        undo_deduction(res.batch, [r for r in res.inventory if r.id != "o"])


def test_undo_ignores_unrelated_changes():
    res = apply_deduction(BOWL, KITCHEN, None, ["oil"])
    changed = [r.model_copy(update={"quantity": q("5", "package")}) if r.id == "t" else r for r in res.inventory]
    restored, _ = undo_deduction(res.batch, changed)
    assert by_id(restored)["o"] == KITCHEN[3] and by_id(restored)["t"].quantity == q("5", "package")


# ----------------------------------------------------------------- combine
def test_combine_rules():
    assert combine_quantities(q("200", "g"), q("1", "lb")).result == q("653.592", "g")
    est = combine_quantities(q("1", "cup"), q("2", "tbsp", "estimated")).result
    assert est.unit == "cup" and est.accuracy.value == "estimated" and est.amount == Decimal("1.125")
    assert combine_quantities(q("2", "clove"), q("2", "clove")).result == q("4", "clove")
    for a, b in [(q("1", "cup"), q("100", "g")), (q("1", "each"), q("1", "clove")),
                 (q("1", "g"), Quantity.unknown()), (None, q("1", "g")), (None, None)]:
        r = combine_quantities(a, b)
        assert r.combinable is False and r.result is None


# --------------------------------------------------------------------- API
def payload(inv):
    return [r.model_dump(mode="json") for r in inv]


def test_apply_and_undo_endpoints_round_trip():
    r = client.post("/api/deductions/apply", json={"recipe_id": "chicken-rice-bowl", "inventory": payload(KITCHEN), "include": ALL})
    assert r.status_code == 200
    body = r.json()
    assert body["inventory"][0]["quantity"]["amount"] == "0.338"
    u = client.post("/api/deductions/undo", json={"batch": body["batch"], "inventory": body["inventory"]})
    assert u.status_code == 200
    assert [InventoryRecord.model_validate(x) for x in u.json()["inventory"]] == KITCHEN


def test_undo_endpoint_conflict_is_409():
    body = client.post("/api/deductions/apply", json={"recipe_id": "chicken-rice-bowl", "inventory": payload(KITCHEN), "include": ["oil"]}).json()
    body["inventory"][3]["quantity"] = {"amount": "1", "unit": "l", "accuracy": "exact"}
    r = client.post("/api/deductions/undo", json={"batch": body["batch"], "inventory": body["inventory"]})
    assert r.status_code == 409 and "cooking oil" in r.json()["detail"]


def test_apply_endpoint_errors():
    assert client.post("/api/deductions/apply", json={"recipe_id": "nope"}).status_code == 404
    no_id = [{"display_name": "chicken", "quantity": {"amount": "1", "unit": "kg", "accuracy": "exact"}}]
    r = client.post("/api/deductions/apply", json={"recipe_id": "chicken-rice-bowl", "inventory": no_id, "include": ["chicken"]})
    assert r.status_code == 422 and "needs an id" in r.json()["detail"]
    dup = [{"id": "a", "display_name": "rice"}, {"id": "b", "display_name": "white rice"}]
    assert client.post("/api/deductions/apply", json={"recipe_id": "chicken-rice-bowl", "inventory": dup}).status_code == 422


def test_combine_endpoint():
    r = client.post("/api/quantities/combine", json={"pairs": [
        {"existing": {"amount": "1", "unit": "kg", "accuracy": "exact"}, "incoming": {"amount": "500", "unit": "g", "accuracy": "exact"}},
        {"existing": {"amount": "1", "unit": "kg", "accuracy": "exact"}, "incoming": {"amount": "2", "unit": "cup", "accuracy": "exact"}},
    ]})
    assert r.status_code == 200
    a, b = r.json()
    assert a["combinable"] and a["result"]["amount"] == "1.5"
    assert not b["combinable"] and "kg and cup" in b["reason"]
