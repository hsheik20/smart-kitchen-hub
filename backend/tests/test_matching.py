from decimal import Decimal

import pytest

from app.data import RECIPES, RECIPES_BY_ID
from app.inventory import InventoryInputError, resolve_inventory
from app.matching import match_recipe, match_recipes
from app.models import InventoryRecord, MatchRequest


def inv(name, amount=None, unit=None, accuracy="exact", **kw):
    quantity = {"accuracy": "unknown"} if amount is None else {"amount": amount, "unit": unit, "accuracy": accuracy}
    return InventoryRecord.model_validate({"display_name": name, "quantity": quantity, **kw})


def check(match, ingredient_id):
    return next(c for c in match.checks if c.ingredient_id == ingredient_id)


BOWL = RECIPES_BY_ID["chicken-rice-bowl"]
SHEET = RECIPES_BY_ID["sheet-pan-chicken"]


def run(recipe, records, **kw):
    return match_recipe(recipe, resolve_inventory(records), **kw)


def test_zero_match_with_empty_inventory():
    m = run(BOWL, [])
    assert m.match_pct == 0
    assert len(m.missing) == 5
    assert all(c.status == "missing" for c in m.checks)


def test_full_match_with_enough():
    m = run(BOWL, [inv("chicken breast", "500", "g"), inv("white rice", "1", "kg"), inv("zucchini", "3", "each"),
                   inv("olive oil", "1", "l"), inv("salt", "500", "g")])
    assert m.match_pct == 100 and m.missing == [] and m.shortages == []
    assert check(m, "chicken").status == "have_enough"
    assert check(m, "oil").status == "have_enough"           # tbsp vs l: converted
    assert check(m, "salt").status == "have_unknown_amount"  # recipe says "to taste"
    assert m.cannot_compare == ["salt"]


def test_shortage_reports_shortfall_in_recipe_unit():
    m = run(BOWL, [inv("chicken", "0.5", "lb", accuracy="estimated")])
    c = check(m, "chicken")
    assert c.status == "have_insufficient"
    assert c.shortfall.amount == Decimal("73.204") and c.shortfall.unit == "g"
    assert c.shortfall.accuracy.value == "estimated"
    assert m.shortages == ["boneless chicken breast"]
    assert any(r.startswith("Not enough") for r in m.rank_reasons)


def test_unknown_inventory_amount_is_not_invented():
    c = check(run(BOWL, [inv("rice")]), "rice")
    assert c.status == "have_unknown_amount"
    assert c.on_hand.amount is None and c.shortfall is None


def test_incompatible_units_are_not_compared():
    c = check(run(BOWL, [inv("rice", "2", "cup")]), "rice")   # recipe uses grams
    assert c.status == "have_incompatible_unit" and c.shortfall is None


def test_count_units_only_match_themselves():
    c = check(run(RECIPES_BY_ID["zucchini-rice"], [inv("garlic", "1", "each")]), "garlic")  # recipe: 2 clove
    assert c.status == "have_incompatible_unit"


def test_out_of_stock_counts_as_missing():
    c = check(run(BOWL, [inv("rice", "1", "kg", availability="out")]), "rice")
    assert c.status == "missing"


def test_staples_not_assumed_by_default():
    m = run(BOWL, [])
    assert check(m, "salt").status == "missing" and check(m, "oil").status == "missing"


def test_assume_staples_counts_presence_but_not_quantity():
    have = [inv("chicken", "300", "g"), inv("rice", "150", "g"), inv("zucchini", "1", "each")]
    without = run(BOWL, have)
    with_staples = run(BOWL, have, assume_staples=True)
    assert without.match_pct == 60
    assert with_staples.match_pct == 100
    assert check(with_staples, "salt").status == "assumed_staple"
    assert check(with_staples, "salt").on_hand is None
    assert sorted(with_staples.assumed_staples) == ["cooking oil", "salt"]
    assert check(with_staples, "chicken").status == "have_enough"  # non-staples unaffected


def test_assume_staples_never_overrides_actual_inventory():
    m = run(BOWL, [inv("oil", "1", "tsp")], assume_staples=True)
    assert check(m, "oil").status == "have_insufficient"


def test_optional_ingredient_excluded_from_match_pct():
    have = [inv("chicken", "1", "kg"), inv("sweet potato", "2", "each"), inv("zucchini", "2", "each"),
            inv("oil", "1", "cup"), inv("salt", "1", "cup")]
    m = run(SHEET, have)
    assert check(m, "black-pepper").status == "optional_missing"
    assert m.match_pct == 100 and m.missing == []


def test_servings_scale_requirements():
    m = run(BOWL, [inv("chicken", "400", "g")], servings=3)
    c = check(m, "chicken")
    assert m.scale_factor == Decimal("1.5")
    assert c.required.amount == Decimal("450") and c.status == "have_insufficient"
    assert c.shortfall.amount == Decimal("50")


def test_unmapped_inventory_is_reported_not_dropped():
    resp = match_recipes(RECIPES, MatchRequest(inventory=[inv("tofu", "1", "package"), inv("rice", "1", "kg")]))
    assert resp.unmapped_inventory == ["tofu"]


def test_ranking_is_deterministic_and_time_filtered():
    req = MatchRequest(inventory=[inv("rice", "1", "kg"), inv("zucchini", "4", "each"), inv("garlic", "4", "clove"),
                                  inv("oil", "1", "cup"), inv("salt", "100", "g")], max_minutes=40)
    first = match_recipes(RECIPES, req)
    second = match_recipes(RECIPES, req)
    assert [m.recipe_id for m in first.matches] == [m.recipe_id for m in second.matches]
    assert first.matches[0].recipe_id == "zucchini-rice"
    assert all(m.total_minutes <= 40 for m in first.matches)
    assert "sheet-pan-chicken" not in [m.recipe_id for m in first.matches]
    assert any("Fits 40-min limit" in r for r in first.matches[0].rank_reasons)


def test_duplicate_inventory_for_same_ingredient_rejected():
    with pytest.raises(InventoryInputError):
        resolve_inventory([inv("rice", "1", "kg"), inv("white rice", "2", "cup")])


def test_unknown_explicit_ingredient_id_rejected():
    with pytest.raises(InventoryInputError):
        resolve_inventory([inv("x", ingredient_id="dragonfruit")])


def test_matching_does_not_mutate_inventory():
    records = [inv("chicken", "100", "g")]
    before = [r.model_copy(deep=True) for r in records]
    match_recipes(RECIPES, MatchRequest(inventory=records, servings=4))
    assert records == before
