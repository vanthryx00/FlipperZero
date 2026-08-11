"""OpenAI-compatible LLM client — works with Ornith, OpenAI, or any vLLM/Ollama server.

Configuration (env vars):
    LLM_BASE_URL  -- Base URL for the API (default: http://localhost:8000/v1)
    LLM_API_KEY   -- API key (default: "not-needed" for local servers)
    LLM_MODEL     -- Model name to request (default: "ornith")

Usage:
    from agentic.llm_client import LLMClient
    client = LLMClient()
    reply = client.chat("Explain how this BadUSB script works: ...")
"""

from __future__ import annotations

import json
import os
from typing import Any

from .store import load_dotenv  # honor repo-root .env (LLM_BASE_URL, LLM_API_KEY, LLM_MODEL)

load_dotenv()

_DEFAULT_BASE_URL = "http://localhost:8000/v1"
_DEFAULT_MODEL = "nousresearch/hermes-4-70b"
_DEFAULT_API_KEY = "not-needed"


class LLMClient:
    """Thin wrapper around an OpenAI-compatible chat-completions endpoint.

    Works with:
        - Ornith served via vLLM (https://github.com/AEON-7/Ornith-1.0-35B-AEON-Ultimate-Uncensored)
        - OpenAI API (api.openai.com)
        - Any Ollama / vLLM / llama.cpp server with an /v1/chat/completions endpoint
    """

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        model: str | None = None,
    ) -> None:
        self.base_url = (base_url or os.environ.get("LLM_BASE_URL") or _DEFAULT_BASE_URL).rstrip("/")
        self.api_key = api_key or os.environ.get("LLM_API_KEY") or _DEFAULT_API_KEY
        self.model = model or os.environ.get("LLM_MODEL") or _DEFAULT_MODEL

    def _endpoint(self) -> str:
        base = self.base_url
        if base.endswith("/v1"):
            return f"{base}/chat/completions"
        return f"{base}/chat/completions"

    def chat(
        self,
        prompt: str,
        *,
        system: str | None = None,
        temperature: float = 0.6,
        top_p: float = 0.95,
        max_tokens: int = 2048,
        extra_body: dict[str, Any] | None = None,
    ) -> str:
        """Send a single-turn chat request and return the model's text reply.

        Uses urllib (stdlib, zero-dependency) so it works without any pip installs.
        """
        import urllib.error
        import urllib.request

        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        body: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "top_p": top_p,
            "max_tokens": max_tokens,
        }
        if extra_body:
            body.update(extra_body)

        data = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(
            self._endpoint(),
            data=data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                result = json.loads(resp.read().decode("utf-8"))
        except urllib.error.URLError as exc:
            msg = f"LLM request failed: {exc}"
            raise RuntimeError(msg) from exc
        except json.JSONDecodeError as exc:
            msg = f"LLM returned non-JSON response"
            raise RuntimeError(msg) from exc

        choice = result.get("choices", [{}])[0]
        content = choice.get("message", {}).get("content", "")
        if not content and choice.get("finish_reason") == "length":
            content = "[truncated — raise max_tokens]"
        return content.strip()

    def chat_stream(
        self,
        prompt: str,
        *,
        system: str | None = None,
        temperature: float = 0.6,
        top_p: float = 0.95,
        max_tokens: int = 2048,
    ):
        """Generator yielding content chunks via SSE streaming."""
        import urllib.error
        import urllib.request

        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        body = json.dumps({
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "top_p": top_p,
            "max_tokens": max_tokens,
            "stream": True,
        }).encode("utf-8")

        req = urllib.request.Request(
            self._endpoint(),
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                for line in resp:
                    line = line.decode("utf-8").strip()
                    if not line or line.startswith(":"):
                        continue
                    if line == "data: [DONE]":
                        break
                    if line.startswith("data: "):
                        try:
                            chunk = json.loads(line[6:])
                            delta = chunk.get("choices", [{}])[0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                yield content
                        except json.JSONDecodeError:
                            continue
        except urllib.error.URLError as exc:
            raise RuntimeError(f"LLM stream failed: {exc}") from exc

    def health(self) -> dict[str, Any]:
        """Probe the endpoint. Returns {'ok': True, ...} or {'ok': False, 'error': ...}."""
        import urllib.error
        import urllib.request

        try:
            req = urllib.request.Request(
                f"{self.base_url}/models",
                headers={"Authorization": f"Bearer {self.api_key}"},
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                models = [m.get("id", "?") for m in data.get("data", [])]
                return {"ok": True, "models": models, "endpoint": self.base_url}
        except Exception as exc:
            return {"ok": False, "error": str(exc), "endpoint": self.base_url}
