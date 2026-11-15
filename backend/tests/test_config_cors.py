import importlib

import pytest
from fastapi.testclient import TestClient

from app.config import DEV_ORIGINS, parse_origins


def test_unset_or_blank_uses_dev_origins():
    assert parse_origins(None) == DEV_ORIGINS
    assert parse_origins("  ") == DEV_ORIGINS


def test_parses_list_trims_and_dedupes():
    assert parse_origins(" https://a.example.com/ , https://b.example.com,https://a.example.com,") == [
        "https://a.example.com", "https://b.example.com"]


@pytest.mark.parametrize("raw", ["*", "https://ok.example.com,*", "ftp://x.example.com", "a.example.com",
                                 "https://x.example.com/app", "https://x.example.com?q=1"])
def test_rejects_wildcard_and_malformed(raw):
    with pytest.raises(ValueError):
        parse_origins(raw)


def _client(monkeypatch, value):
    if value is None:
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
    else:
        monkeypatch.setenv("CORS_ORIGINS", value)
    import app.main as main
    return TestClient(importlib.reload(main).app)


def _preflight(client, origin, method="POST"):
    return client.options("/api/recipes/match", headers={
        "Origin": origin, "Access-Control-Request-Method": method, "Access-Control-Request-Headers": "content-type"})


def test_configured_origin_allowed_for_post(monkeypatch):
    client = _client(monkeypatch, "https://kitchen.example.com")
    r = _preflight(client, "https://kitchen.example.com")
    assert r.status_code == 200 and r.headers["access-control-allow-origin"] == "https://kitchen.example.com"
    get = client.get("/api/health", headers={"Origin": "https://kitchen.example.com"})
    assert get.headers["access-control-allow-origin"] == "https://kitchen.example.com"


def test_other_origins_refused_in_production(monkeypatch):
    client = _client(monkeypatch, "https://kitchen.example.com")
    assert "access-control-allow-origin" not in _preflight(client, "https://evil.example.com").headers
    assert "access-control-allow-origin" not in _preflight(client, "http://localhost:5173").headers


def test_dev_default_allows_local_vite(monkeypatch):
    client = _client(monkeypatch, None)
    assert _preflight(client, "http://127.0.0.1:5173").headers["access-control-allow-origin"] == "http://127.0.0.1:5173"
    assert "access-control-allow-origin" not in _preflight(client, "https://kitchen.example.com").headers


def test_unsupported_method_not_allowed(monkeypatch):
    client = _client(monkeypatch, "https://kitchen.example.com")
    assert _preflight(client, "https://kitchen.example.com", method="DELETE").status_code == 400


@pytest.fixture(autouse=True)
def _restore_app(monkeypatch):
    yield
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    import app.main as main
    importlib.reload(main)
