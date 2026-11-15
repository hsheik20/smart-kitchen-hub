"""Deployment settings read from environment variables (no secrets live here).

CORS_ORIGINS — comma-separated list of browser origins allowed to call the API,
e.g. "https://your-frontend.onrender.com". When unset, only the local Vite dev
and preview origins are allowed. A wildcard ("*") is refused so a production
deployment can't accidentally accept every origin (ADR-028).
"""
from __future__ import annotations

import os
from urllib.parse import urlsplit

DEV_ORIGINS = [
    "http://localhost:5173", "http://127.0.0.1:5173",   # npm run dev
    "http://localhost:4173", "http://127.0.0.1:4173",   # npm run preview
]


def parse_origins(raw: str | None) -> list[str]:
    """Parse CORS_ORIGINS. Empty/unset → local dev origins. Raises ValueError on '*' or malformed values."""
    if raw is None or not raw.strip():
        return list(DEV_ORIGINS)
    origins: list[str] = []
    for item in raw.split(","):
        origin = item.strip().rstrip("/")
        if not origin:
            continue
        if origin == "*":
            raise ValueError("CORS_ORIGINS must list explicit origins; '*' is not allowed")
        parts = urlsplit(origin)
        if parts.scheme not in ("http", "https") or not parts.netloc or parts.path or parts.query or parts.fragment:
            raise ValueError(f"CORS_ORIGINS entry {item.strip()!r} must look like https://host[:port] with no path")
        if origin not in origins:
            origins.append(origin)
    return origins


def cors_origins() -> list[str]:
    return parse_origins(os.environ.get("CORS_ORIGINS"))
