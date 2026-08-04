"""Durable state stores for the agentic workflow.

Two interchangeable backends implement the same Store interface; the Engine
and the agents never touch the backend directly:

- AtlasStore -- MongoDB Atlas via pymongo. Durable cloud state with complex
  nested documents. Keyword search uses a regular MongoDB text index on
  ``search_text`` (works on the free M0 tier); Atlas Vector Search
  (``$vectorSearch``) requires an M10+ dedicated tier.
- FileStore  -- stdlib-only JSON files under ``agentic/_local_state/``.
  Used automatically when ``MONGODB_URI`` is unset or pymongo is missing,
  so the workflow is fully runnable and testable with zero dependencies.
"""
from __future__ import annotations

import json
import os
import re
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]


class StoreFeatureError(RuntimeError):
    """A requested capability needs a backend/tier that isn't available."""


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _new_id() -> str:
    return uuid.uuid4().hex[:12]


def load_dotenv(dotenv_path: Path | str | None = None) -> None:
    """Tiny stdlib-only .env loader (no python-dotenv dependency).

    Reads KEY=VALUE lines from a .env file at the repo root (or an explicit
    path) into os.environ without overwriting already-set variables.
    """
    path = Path(dotenv_path) if dotenv_path else REPO_ROOT / ".env"
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


class FileStore:
    """Zero-dependency JSON fallback. Same interface as AtlasStore."""

    backend = "file"

    def __init__(self, data_dir: Path | str | None = None) -> None:
        self.data_dir = Path(
            data_dir
            or os.environ.get("FLIPPERZERO_STATE_DIR")
            or (REPO_ROOT / "agentic" / "_local_state")
        )
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._runs: list[dict[str, Any]] = self._load("workflow_runs.json")
        self._payloads: list[dict[str, Any]] = self._load("payloads.json")
        self._devintel: list[dict[str, Any]] = self._load("devintel_snapshots.json")

    # -- low-level -----------------------------------------------------
    def _load(self, name: str) -> list[dict[str, Any]]:
        p = self.data_dir / name
        if not p.exists():
            return []
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            return data if isinstance(data, list) else []
        except Exception:
            return []

    def _save(self, name: str, data: list[dict[str, Any]]) -> None:
        p = self.data_dir / name
        p.write_text(
            json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
        )

    # -- runs ----------------------------------------------------------
    def save_run(self, run: dict[str, Any]) -> str:
        with self._lock:
            run["_id"] = run.get("_id") or _new_id()
            self._runs.append(run)
            self._save("workflow_runs.json", self._runs)
        return run["_id"]

    def get_run(self, run_id: str) -> dict[str, Any] | None:
        for doc in self._runs:
            if doc.get("_id") == run_id:
                return doc
        return None

    def update_run(self, run_id: str, patch: dict[str, Any]) -> None:
        with self._lock:
            for doc in self._runs:
                if doc.get("_id") == run_id:
                    doc.update(patch)
                    break
            self._save("workflow_runs.json", self._runs)

    def list_runs(self, status: str | None = None, limit: int = 20) -> list[dict[str, Any]]:
        runs = self._runs
        if status:
            runs = [r for r in runs if r.get("status") == status]
        return list(reversed(runs))[:limit]

    def count_runs(self) -> int:
        return len(self._runs)

    # -- payloads ------------------------------------------------------
    def upsert_payload(self, doc: dict[str, Any]) -> str:
        with self._lock:
            doc["_id"] = doc.get("_id") or _new_id()
            for i, d in enumerate(self._payloads):
                if d.get("_id") == doc["_id"]:
                    self._payloads[i] = doc
                    break
            else:
                self._payloads.append(doc)
            self._save("payloads.json", self._payloads)
        return doc["_id"]

    def list_payloads(self, limit: int = 10_000) -> list[dict[str, Any]]:
        return self._payloads[:limit]

    def count_payloads(self) -> int:
        return len(self._payloads)

    def remove_payloads_not_in(self, keep_ids: set[str]) -> int:
        """Drop payload docs whose _id is not in keep_ids; returns count removed."""
        with self._lock:
            before = len(self._payloads)
            self._payloads = [d for d in self._payloads if d.get("_id") in keep_ids]
            removed = before - len(self._payloads)
            if removed:
                self._save("payloads.json", self._payloads)
        return removed

    # -- devintel snapshots -------------------------------------------
    def save_devintel_snapshot(self, doc: dict[str, Any]) -> str:
        doc["_id"] = doc.get("_id") or _new_id()
        with self._lock:
            for i, d in enumerate(self._devintel):
                if d.get("_id") == doc["_id"]:
                    self._devintel[i] = doc
                    break
            else:
                self._devintel.append(doc)
            self._save("devintel_snapshots.json", self._devintel)
        return doc["_id"]

    def list_devintel_snapshots(self, limit: int = 90) -> list[dict[str, Any]]:
        return list(reversed(self._devintel))[:limit]

    def get_devintel_snapshot(self, day: str) -> dict[str, Any] | None:
        for d in self._devintel:
            if d.get("_id") == day:
                return d
        return None

    def count_devintel_snapshots(self) -> int:
        return len(self._devintel)

    # -- retrieval -----------------------------------------------------
    def search_payloads(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        """Token-overlap scoring over search_text (mimics $text OR semantics)."""
        q_tokens = set(re.findall(r"[a-z0-9]+", query.lower()))
        if not q_tokens:
            return []
        scored: list[tuple[float, dict[str, Any]]] = []
        for doc in self._payloads:
            text = (doc.get("search_text") or "").lower()
            doc_tokens = set(re.findall(r"[a-z0-9]+", text))
            if not doc_tokens:
                continue
            overlap = len(q_tokens & doc_tokens)
            if overlap > 0:
                scored.append((overlap / len(q_tokens), doc))
        scored.sort(key=lambda t: -t[0])
        return [d for _, d in scored[:limit]]

    def vector_search_payloads(self, vector: list[float], limit: int = 5) -> list[dict[str, Any]]:
        from .embed import cosine

        scored: list[tuple[float, dict[str, Any]]] = []
        for doc in self._payloads:
            emb = doc.get("embedding")
            if not emb:
                continue
            scored.append((cosine(vector, emb), doc))
        scored.sort(key=lambda t: -t[0])
        return [d for _, d in scored[:limit]]

    # -- index management ----------------------------------------------
    def ensure_indexes(self) -> list[str]:
        return ["file-local (no indexes needed)"]

    def create_search_indexes(self) -> list[str]:
        raise StoreFeatureError(
            "local FileStore has no Atlas search indexes -- set MONGODB_URI "
            "and use 'python -m agentic indexes' against Atlas."
        )

    def index_status(self) -> dict[str, Any]:
        return {
            "payloads_indexes": ["file-local"],
            "search_indexes": "n/a (local store)",
        }

    def ping(self) -> bool:
        return True

    def reset(self) -> None:
        with self._lock:
            self._runs = []
            self._payloads = []
            self._devintel = []
            self._save("workflow_runs.json", self._runs)
            self._save("payloads.json", self._payloads)
            self._save("devintel_snapshots.json", self._devintel)


class AtlasStore:
    """MongoDB Atlas backend (requires pymongo >= 4.6)."""

    backend = "atlas"

    def __init__(
        self,
        uri: str | None = None,
        db_name: str = "flipperzero_agentic",
        server_selection_timeout_ms: int = 8000,
    ) -> None:
        uri = uri or os.environ.get("MONGODB_URI")
        if not uri:
            raise StoreFeatureError(
                "MONGODB_URI is not set -- pass uri= or set the env var."
            )
        try:
            from pymongo import ASCENDING, DESCENDING, TEXT, MongoClient
        except ImportError as exc:
            raise StoreFeatureError(
                "pymongo is not installed. Run: pip install pymongo>=4.6  "
                "(or unset MONGODB_URI to use the local FileStore)."
            ) from exc
        self._ASC, self._DESC, self._TEXT = ASCENDING, DESCENDING, TEXT
        self._client = MongoClient(
            uri,
            serverSelectionTimeoutMS=server_selection_timeout_ms,
            connectTimeoutMS=10_000,
            socketTimeoutMS=30_000,
            retryWrites=True,
        )
        self.db = self._client[db_name]
        self.runs = self.db["workflow_runs"]
        self.payloads = self.db["payloads"]
        self.devintel = self.db["devintel_snapshots"]

    # -- runs ----------------------------------------------------------
    def save_run(self, run: dict[str, Any]) -> str:
        run["_id"] = run.get("_id") or _new_id()
        self.runs.replace_one({"_id": run["_id"]}, run, upsert=True)
        return run["_id"]

    def get_run(self, run_id: str) -> dict[str, Any] | None:
        return self.runs.find_one({"_id": run_id})

    def update_run(self, run_id: str, patch: dict[str, Any]) -> None:
        self.runs.update_one({"_id": run_id}, {"$set": patch})

    def list_runs(self, status: str | None = None, limit: int = 20) -> list[dict[str, Any]]:
        q = {"status": status} if status else {}
        return list(
            self.runs.find(q).sort("created_at", self._DESC).limit(limit)
        )

    def count_runs(self) -> int:
        return self.runs.count_documents({})

    # -- payloads ------------------------------------------------------
    def upsert_payload(self, doc: dict[str, Any]) -> str:
        doc["_id"] = doc.get("_id") or _new_id()
        self.payloads.replace_one({"_id": doc["_id"]}, doc, upsert=True)
        return doc["_id"]

    def list_payloads(self, limit: int = 10_000) -> list[dict[str, Any]]:
        return list(self.payloads.find({}).limit(limit))

    def count_payloads(self) -> int:
        return self.payloads.count_documents({})

    def remove_payloads_not_in(self, keep_ids: set[str]) -> int:
        """Drop payload docs whose _id is not in keep_ids; returns count removed."""
        res = self.payloads.delete_many({"_id": {"$nin": list(keep_ids)}})
        return res.deleted_count

    # -- devintel snapshots -------------------------------------------
    def save_devintel_snapshot(self, doc: dict[str, Any]) -> str:
        doc["_id"] = doc.get("_id") or _new_id()
        self.devintel.replace_one({"_id": doc["_id"]}, doc, upsert=True)
        return doc["_id"]

    def list_devintel_snapshots(self, limit: int = 90) -> list[dict[str, Any]]:
        return list(
            self.devintel.find({}).sort("created_at", self._DESC).limit(limit)
        )

    def get_devintel_snapshot(self, day: str) -> dict[str, Any] | None:
        return self.devintel.find_one({"_id": day})

    def count_devintel_snapshots(self) -> int:
        return self.devintel.count_documents({})

    # -- retrieval -----------------------------------------------------
    def search_payloads(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        """Keyword search via $text -- works on the free M0 tier."""
        """Keyword search via $text -- works on the free M0 tier."""
        try:
            return list(
                self.payloads.find(
                    {"$text": {"$search": query}},
                    {"score": {"$meta": "textScore"}},
                )
                .sort([("score", {"$meta": "textScore"})])
                .limit(limit)
            )
        except Exception as exc:
            raise StoreFeatureError(
                "$text search failed -- run 'python -m agentic indexes' to "
                f"create the text index. Detail: {exc}"
            ) from exc

    def vector_search_payloads(self, vector: list[float], limit: int = 5) -> list[dict[str, Any]]:
        """Atlas Vector Search -- requires M10+ tier and the vector index."""
        pipeline = [
            {
                "$vectorSearch": {
                    "index": "payloads_vector",
                    "path": "embedding",
                    "queryVector": vector,
                    "numCandidates": max(20, limit * 4),
                    "limit": limit,
                }
            }
        ]
        try:
            return list(self.payloads.aggregate(pipeline))
        except Exception as exc:
            raise StoreFeatureError(
                "Atlas Vector Search is unavailable -- it requires an M10+ "
                "dedicated tier and the 'payloads_vector' index (create via "
                f"'python -m agentic indexes'). Detail: {exc}"
            ) from exc

    # -- index management ----------------------------------------------
    def ensure_indexes(self) -> list[str]:
        created: list[str] = []
        for coll, name, keys in (
            (self.runs, "created_at", [("created_at", self._DESC)]),
            (self.runs, "status", [("status", self._ASC)]),
            (self.payloads, "kind", [("kind", self._ASC)]),
            (self.devintel, "created_at", [("created_at", self._DESC)]),
        ):
            coll.create_index(keys)
            created.append(f"{coll.name}.{name}")
        self.payloads.create_index([("search_text", self._TEXT)])
        created.append("payloads.search_text(text)")
        return created

    def create_search_indexes(self) -> list[str]:
        from pymongo.operations import SearchIndexModel

        try:
            existing = {i["name"] for i in self.payloads.list_search_indexes()}
        except Exception as exc:
            raise StoreFeatureError(
                "list_search_indexes failed -- Atlas Search/Vector Search "
                f"require an M10+ dedicated tier (free M0 does not). Detail: {exc}"
            ) from exc
        created: list[str] = []
        if "payloads_search" not in existing:
            self.payloads.create_search_index(
                SearchIndexModel(
                    name="payloads_search",
                    type="search",
                    definition={
                        "mappings": {
                            "dynamic": True,
                            "fields": {
                                "name": {"type": "string"},
                                "kind": {"type": "string"},
                                "search_text": {"type": "string"},
                            },
                        }
                    },
                )
            )
            created.append("payloads_search")
        if "payloads_vector" not in existing:
            self.payloads.create_search_index(
                SearchIndexModel(
                    name="payloads_vector",
                    type="vectorSearch",
                    definition={
                        "fields": [
                            {
                                "type": "vector",
                                "path": "embedding",
                                "numDimensions": 256,
                                "similarity": "cosine",
                            }
                        ]
                    },
                )
            )
            created.append("payloads_vector")
        return created

    def index_status(self) -> dict[str, Any]:
        status: dict[str, Any] = {}
        try:
            status["payloads_indexes"] = [
                i["name"] for i in self.payloads.list_indexes()
            ]
        except Exception as exc:  # pragma: no cover
            status["payloads_indexes"] = f"error: {exc}"
        try:
            status["search_indexes"] = [
                i["name"] for i in self.payloads.list_search_indexes()
            ]
        except Exception:
            status["search_indexes"] = "n/a (M10+ tier required)"
        return status

    def ping(self) -> bool:
        self._client.admin.command("ping")
        return True


def get_store(uri: str | None = None):
    """Pick the backend: Atlas when a URI is available, else local FileStore."""
    load_dotenv()  # honor .env (MONGODB_URI, FLIPPERZERO_*) if present
    if uri or os.environ.get("MONGODB_URI"):
        return AtlasStore(uri)
    return FileStore()
