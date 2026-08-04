"""Agentic workflow: durable, queryable agent orchestration backed by
MongoDB Atlas, with a zero-dependency local fallback.

Two interchangeable backends (see agentic/store.py):
  AtlasStore -- MongoDB Atlas (pymongo). Durable cloud state, complex nested
                documents, $text keyword search on the free M0 tier, Atlas
                Vector Search ($vectorSearch) on M10+ dedicated tiers.
  FileStore  -- stdlib-only JSON fallback under agentic/_local_state/. Used
                when MONGODB_URI is unset or pymongo is missing, so the whole
                workflow runs and is testable with zero dependencies.

Typical use:
    python -m agentic run pipeline
    python -m agentic runs
    python -m agentic search "tesla"
    python -m agentic vector "camera shutter"
"""
from __future__ import annotations

__version__ = "0.1.0"

from .store import (  # noqa: F401
    REPO_ROOT,
    AtlasStore,
    FileStore,
    StoreFeatureError,
    get_store,
)
from .core import Agent, Engine, Workflow  # noqa: F401
from .retrieval import (  # noqa: F401
    payloads_by_kind,
    recent_runs,
    search_payloads,
    similar_payloads,
    store_health,
)
from .llm_client import LLMClient  # noqa: F401
