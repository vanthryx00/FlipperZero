"""Embeddings for vector retrieval.

Default: FeatureHashEmbedder -- deterministic, zero-dependency signed
feature-hashing into VECTOR_DIM dimensions. Same vocabulary => similar
vectors, so it is keyword-ish rather than truly semantic. For real semantic
search, set OPENAI_API_KEY and install `openai`; get_embedder() then returns
an OpenAIEmbedder automatically.
"""
from __future__ import annotations

import hashlib
import math
import os
import re

VECTOR_DIM = 256

_WORD_RE = re.compile(r"[a-z0-9]+")


def cosine(a: list[float], b: list[float]) -> float:
    if len(a) != len(b):
        raise ValueError(f"vector dim mismatch: {len(a)} vs {len(b)}")
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def _hash_dim(token: str, dim: int, salt: int = 0) -> tuple[int, float]:
    """Map a token to (index, sign) via SHA-256 -- stable across runs."""
    h = hashlib.sha256(f"{salt}:{token}".encode("utf-8")).digest()
    idx = int.from_bytes(h[:4], "big") % dim
    sign = 1.0 if h[4] % 2 == 0 else -1.0
    return idx, sign


class FeatureHashEmbedder:
    """Zero-dependency, deterministic embedder (signed feature hashing)."""

    name = "feature-hash"
    dim = VECTOR_DIM

    def embed(self, text: str) -> list[float]:
        vec = [0.0] * self.dim
        low = text.lower()
        for tok in set(_WORD_RE.findall(low)):
            idx, sign = _hash_dim(tok, self.dim)
            vec[idx] += sign
        # character trigrams add lightweight positional signal
        chars = re.sub(r"[^a-z0-9]", "", low)
        for i in range(len(chars) - 2):
            idx, _ = _hash_dim(chars[i : i + 3], self.dim, salt=1)
            vec[idx] += 1.0
        norm = math.sqrt(sum(v * v for v in vec))
        if norm == 0:
            return vec
        return [v / norm for v in vec]

    def embed_many(self, texts: list[str]) -> list[list[float]]:
        return [self.embed(t) for t in texts]


class OpenAIEmbedder:
    """Semantic embeddings via the OpenAI API (optional dependency)."""

    name = "openai"
    dim = 1536

    def __init__(self, api_key: str | None = None, model: str = "text-embedding-3-small") -> None:
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        if not self.api_key:
            raise RuntimeError("OPENAI_API_KEY is not set")
        self.model = model

    def embed(self, text: str) -> list[float]:
        try:
            from openai import OpenAI
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError("openai package not installed (pip install openai)") from exc
        client = OpenAI(api_key=self.api_key)
        resp = client.embeddings.create(model=self.model, input=[text])
        return resp.data[0].embedding

    def embed_many(self, texts: list[str]) -> list[list[float]]:
        try:
            from openai import OpenAI
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError("openai package not installed (pip install openai)") from exc
        client = OpenAI(api_key=self.api_key)
        resp = client.embeddings.create(model=self.model, input=texts)
        return [d.embedding for d in resp.data]


def get_embedder():
    """Prefer a semantic embedder when configured, else the zero-dep one."""
    if os.environ.get("OPENAI_API_KEY"):
        try:
            return OpenAIEmbedder()
        except Exception:
            pass
    return FeatureHashEmbedder()
