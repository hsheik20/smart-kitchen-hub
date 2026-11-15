from fastapi.testclient import TestClient

from app.main import app
from app.models import InventoryRecord
from app.stock import stock_status

client = TestClient(app)


def rec(amount=None, unit=None, threshold=None, availability="available"):
    q = {"accuracy": "unknown"} if amount is None else {"amount": amount, "unit": unit, "accuracy": "estimated"}
    data = {"id": "i1", "display_name": "rice", "quantity": q, "availability": availability}
    if threshold:
        data["low_stock_threshold"] = {"amount": threshold[0], "unit": threshold[1], "accuracy": "exact"}
    return InventoryRecord.model_validate(data)


def test_stock_status_rules():
    assert stock_status(rec("1", "kg", availability="out")).status == "out"
    assert stock_status(rec("1", "kg")).status == "unknown"                       # no threshold
    assert stock_status(rec(None, None, ("200", "g"))).status == "unknown"        # unknown amount, not 0
    assert stock_status(rec("2", "cup", ("200", "g"))).status == "unknown"        # incompatible units
    assert stock_status(rec("0.2", "kg", ("200", "g"))).status == "low"           # equal counts as low
    assert stock_status(rec("150", "g", ("200", "g"))).status == "low"
    assert stock_status(rec("1", "lb", ("200", "g"))).status == "ok"


def test_stock_status_endpoint():
    r = client.post("/api/inventory/stock-status", json={"inventory": [
        {"id": "a", "display_name": "rice", "quantity": {"amount": "100", "unit": "g", "accuracy": "exact"},
         "low_stock_threshold": {"amount": "250", "unit": "g", "accuracy": "exact"}},
        {"id": "b", "display_name": "salt"},
    ]})
    assert r.status_code == 200
    assert [(s["id"], s["status"]) for s in r.json()] == [("a", "low"), ("b", "unknown")]


def test_full_recipe_endpoint():
    r = client.get("/api/recipes/chicken-rice-bowl/full")
    assert r.status_code == 200
    body = r.json()
    assert body["source"]["is_sample_data"] is True and body["rating"] is None
    assert body["ingredients"][0]["quantity"] == {"amount": "300", "unit": "g", "accuracy": "exact", "display_text": "300 g"}
    assert body["steps"][0]["number"] == 1 and body["safety_cautions"]
    assert client.get("/api/recipes/nope/full").status_code == 404


def test_legacy_detail_unchanged_by_full_endpoint():
    assert "minutes" in client.get("/api/recipes/chicken-rice-bowl").json()


def test_units_endpoint():
    units = {u["code"]: u["dimension"] for u in client.get("/api/units").json()}
    assert units["g"] == "mass" and units["cup"] == "volume" and units["clove"] == "count"
