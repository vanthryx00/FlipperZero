"""Convenience retrieval helpers that work across both store backends."""
from __future__ import annotations

from typing import Any


def recent_runs(store: Any, limit: int = 10, status: str | None = None) -> list[dict[str, Any]]:
    """Most recent workflow runs, optionally filtered by status."""
    return store.list_runs(status=status, limit=limit)


def payloads_by_kind(store: Any, limit: int = 10_000) -> dict[str, int]:
    """Count curated payload documents grouped by kind (subghz/ir/nfc/...)."""
    counts: dict[str, int] = {}
    for doc in store.list_payloads(limit=limit):
        kind = doc.get("kind") or "unknown"
        counts[kind] = counts.get(kind, 0) + 1
    return counts


def search_payloads(store: Any, query: str, limit: int = 10) -> list[dict[str, Any]]:
    """Keyword search over payload metadata (M0-friendly $text / local scoring)."""
    return store.search_payloads(query, limit)


def similar_payloads(store: Any, embedder: Any, text: str, limit: int = 5) -> list[dict[str, Any]]:
    """Vector similarity search: embed the query, then find nearest payloads."""
    return store.vector_search_payloads(embedder.embed(text), limit)


def store_health(store: Any) -> dict[str, Any]:
    """Human-readable health summary of the active store backend."""
    info: dict[str, Any] = {"backend": store.backend}
    try:
        info["ping"] = bool(store.ping())
    except Exception as exc:  # noqa: BLE001 - health report must not raise
        info["ping"] = f"error: {exc}"
    for key, fn in (
        ("payloads", store.count_payloads),
        ("runs", store.count_runs),
        ("devintel_snapshots", store.count_devintel_snapshots),
    ):
        try:
            info[key] = fn()
        except Exception as exc:  # noqa: BLE001
            info[key] = f"error: {exc}"
    try:
        info.update(store.index_status())
    except Exception as exc:  # noqa: BLE001
        info["index_status"] = f"error: {exc}"
    return info
