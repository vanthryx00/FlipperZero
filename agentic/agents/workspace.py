"""Workspace agents: the concrete 'pipeline' that turns this repo into
durable, queryable state.

    validate -> curate -> sync-plan -> report

- validate:  runs the two payload validators (header check + data tests).
- curate:    indexes every payload file's metadata, attribution, notes and a
             text blob (with embedding) into the store's 'payloads' docs.
- sync-plan: previews + audits exactly what flipper-sync.ps1 would push to a
             plugged-in Flipper, flagging PC-only content that slips through.
- report:    aggregates the curated state (payloads by kind, recent runs).
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path
from typing import Any

from ..core import Agent, AgentContext, Workflow
from ..embed import get_embedder
from ..store import _iso

REPO_ROOT = Path(__file__).resolve().parents[2]

# Mirrors flipper-sync.ps1 exactly: PC-only content never leaves this machine.
SKIP_DIRS = {"_vendor", "scripts", "consolidation", ".git"}
ROOT_SKIP_NAMES = {".gitignore", ".env", ".env.example"}
ROOT_SKIP_SUFFIXES = {".md", ".cmd", ".ps1"}

# Canonical Flipper SD-card folders (what a real device exposes at its root).
CANONICAL_SD_DIRS = {
    "apps", "badusb", "dolphin", "ibutton", "infrared", "lfrfid",
    "music_player", "nfc", "settings", "subghz", "u2f", "update",
}

# Put the shared header-validator helpers on the path so the curate agent
# reuses its battle-tested Key:Value parser instead of reimplementing one.
_SCRIPTS = REPO_ROOT / "scripts"
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))


def _run_validator(script: str, args: list[str]) -> dict[str, Any]:
    proc = subprocess.run(
        [sys.executable, str(REPO_ROOT / "scripts" / script), *args],
        capture_output=True,
        text=True,
        timeout=300,
    )
    out = proc.stdout or ""
    return {
        "script": script,
        "exit_code": proc.returncode,
        "ok_lines": re.findall(r"^\s*\[OK\s*\]\s*(.*)$", out, re.MULTILINE),
        "fail_lines": re.findall(r"^\s*\[FAIL(?:ED)?\s*\]\s*(.*)$", out, re.MULTILINE),
        "warn_lines": re.findall(r"^\s*\[WARN(?:ING)?\s*\]\s*(.*)$", out, re.MULTILINE),
        "stdout_tail": out[-4000:],
        "stderr_tail": (proc.stderr or "")[-2000:],
    }


def _headers(text: str) -> dict[str, str]:
    """Key: Value headers -- reuse verify_flipper_files.parse_kv when possible."""
    try:
        import verify_flipper_files  # from scripts/ (added to sys.path above)

        return {k: v for k, v in verify_flipper_files.parse_kv(text).items()}
    except Exception:  # pragma: no cover - fallback if the module layout changes
        out: dict[str, str] = {}
        for line in text.splitlines():
            if ":" in line and not line.lstrip().startswith("#"):
                key, _, value = line.partition(":")
                out[key.strip().lower()] = value.strip()
        return out


def _attribution(text: str) -> str:
    """First header comment naming the upstream repo (attribution line)."""
    for line in text.splitlines()[:60]:
        if re.search(r"github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", line):
            return line.lstrip("# ").strip()
    return ""


def _notes(text: str) -> str:
    """First header comment with an honesty/reality qualifier, if any."""
    for line in text.splitlines()[:60]:
        s = line.lstrip("# ").strip()
        if re.search(r"\b(honest|NOT captured|synthetic|synthesized|template|real capture)\b", s, re.IGNORECASE):
            return s
    return ""


def _sha256(data: bytes) -> str:
    import hashlib

    return hashlib.sha256(data).hexdigest()


def _walk_payload_files():
    """Yield (path, top_level_kind) for every file inside canonical SD dirs."""
    for top in sorted(CANONICAL_SD_DIRS):
        base = REPO_ROOT / top
        if not base.is_dir():
            continue
        for f in sorted(base.rglob("*")):
            if f.is_file() and f.name not in {".gitkeep", "Thumbs.db"}:
                yield f, top


# ── validate ─────────────────────────────────────────────────────────────
def _validate(ctx: AgentContext) -> dict[str, Any]:
    root = ctx.workspace_root
    header = _run_validator("verify_flipper_files.py", [str(root)])
    data = _run_validator("test_flipper_payloads.py", ["--root", str(root)])
    passed = header["exit_code"] == 0 and data["exit_code"] == 0
    if not passed:
        raise RuntimeError(
            f"validation failed: header exit={header['exit_code']}, "
            f"data exit={data['exit_code']}"
        )
    return {
        "passed": True,
        "header": {
            "exit_code": header["exit_code"],
            "ok_count": len(header["ok_lines"]),
            "warn_count": len(header["warn_lines"]),
        },
        "data": {
            "exit_code": data["exit_code"],
            "ok_count": len(data["ok_lines"]),
            "warn_count": len(data["warn_lines"]),
        },
    }


validate_agent = Agent(
    "validate",
    _validate,
    "Run both payload validators (header check + data tests); fail fast on any error.",
)

# ── curate ───────────────────────────────────────────────────────────────
def _curate(ctx: AgentContext) -> dict[str, Any]:
    embedder = get_embedder()
    curated: list[dict[str, str]] = []
    skipped: list[dict[str, str]] = []
    seen_ids: set[str] = set()
    for path, kind in _walk_payload_files():
        try:
            raw = path.read_bytes()
        except OSError as exc:
            skipped.append({"path": str(path), "reason": f"read error: {exc}"})
            continue
        text = raw.decode("utf-8", errors="replace")
        headers = _headers(text)
        attribution = _attribution(text)
        notes = _notes(text)
        search_text = " ".join(
            filter(None, [path.name, kind, *headers.values(), attribution, notes])
        )
        doc = {
            "_id": _sha256(raw),  # hash the original bytes, not re-encoded text
            "name": path.name,
            "kind": kind,
            "path": path.relative_to(REPO_ROOT).as_posix(),
            "size": path.stat().st_size,
            "headers": headers,
            "attribution": attribution,
            "notes": notes,
            "search_text": search_text.lower(),
            "embedding": embedder.embed(search_text),
            "updated_at": _iso(),
        }
        ctx.store.upsert_payload(doc)
        seen_ids.add(doc["_id"])
        curated.append({"name": path.name, "kind": kind})
    # Converge: drop docs for files that no longer exist (or whose content
    # hash changed), so re-running curate is idempotent.
    removed = ctx.store.remove_payloads_not_in(seen_ids)
    return {
        "curated_count": len(curated),
        "removed_stale": removed,
        "skipped_count": len(skipped),
        "skipped": skipped,
        "embedder": embedder.name,
    }


curate_agent = Agent(
    "curate",
    _curate,
    "Index every payload's metadata + search text + embedding into the store.",
)

# ── sync-plan ────────────────────────────────────────────────────────────
def _sync_plan(ctx: AgentContext) -> dict[str, Any]:
    root = ctx.workspace_root
    plan: list[dict[str, Any]] = []

    def walk(directory: Path, is_root: bool) -> None:
        for e in sorted(directory.iterdir()):
            if e.name in SKIP_DIRS:
                continue
            if is_root and not e.is_dir() and (
                e.name in ROOT_SKIP_NAMES or e.suffix.lower() in ROOT_SKIP_SUFFIXES
            ):
                continue
            if e.is_dir():
                walk(e, False)
            else:
                rel = e.relative_to(root).as_posix()
                plan.append({"rel": rel, "size": e.stat().st_size, "target": rel})

    walk(root, True)

    # Audit: anything whose top-level folder is not a canonical SD folder is
    # PC-only content flipper-sync.ps1's current skip list would push anyway.
    advisories: list[dict[str, Any]] = []
    by_dir: dict[str, int] = {}
    for item in plan:
        top = item["rel"].split("/")[0]
        by_dir[top] = by_dir.get(top, 0) + 1
        if top not in CANONICAL_SD_DIRS:
            advisories.append(
                {
                    "rel": item["rel"],
                    "size": item["size"],
                    "why": f"{top!r} is not a canonical SD folder -- consider adding it to SKIP_DIRS in flipper-sync.ps1",
                }
            )

    return {
        "total_files": len(plan),
        "total_bytes": sum(i["size"] for i in plan),
        "by_dir": by_dir,
        "plan": plan,
        "advisories": advisories,
        "note": "Rules mirror flipper-sync.ps1 (skip _vendor/scripts/consolidation/.git + root *.md/*.cmd/*.ps1/.gitignore).",
    }


sync_plan_agent = Agent(
    "sync-plan",
    _sync_plan,
    "Preview + audit exactly what flipper-sync.ps1 would push to the device.",
)

# ── report ───────────────────────────────────────────────────────────────
def _report(ctx: AgentContext) -> dict[str, Any]:
    from ..retrieval import payloads_by_kind

    by_kind = payloads_by_kind(ctx.store)
    runs = ctx.store.list_runs(limit=10)
    return {
        "payloads_by_kind": dict(sorted(by_kind.items())),
        "total_payloads": sum(by_kind.values()),
        "recent_runs": [
            {
                "id": r["_id"],
                "workflow": r.get("workflow"),
                "status": r.get("status"),
                "created_at": r.get("created_at"),
            }
            for r in runs
        ],
    }


report_agent = Agent(
    "report",
    _report,
    "Aggregate curated payload state (counts by kind, recent runs).",
)

# ── workflows ────────────────────────────────────────────────────────────
PIPELINE = Workflow(
    "pipeline",
    "validate -> curate -> sync-plan -> report",
    [validate_agent, curate_agent, sync_plan_agent, report_agent],
)

from .devintel import DEVINTEL  # noqa: E402  (import after module-level agents)

WORKFLOWS: dict[str, Workflow] = {
    "validate": Workflow("validate", "Run both payload validators", [validate_agent]),
    "curate": Workflow("curate", "Index payload metadata + embeddings", [curate_agent]),
    "sync-plan": Workflow(
        "sync-plan", "Preview + audit what flipper-sync.ps1 would push", [sync_plan_agent]
    ),
    "report": Workflow("report", "Aggregate curated payload state", [report_agent]),
    "pipeline": PIPELINE,
    "devintel": DEVINTEL,
}
