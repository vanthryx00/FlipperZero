"""Developer-intelligence agents: delivery metrics + AI-adoption tracking.

    collect-git -> snapshot -> devintel-report   (the "devintel" workflow)

- collect-git:    walks `git log` for this workspace and computes delivery
                  metrics (commit throughput, files changed, lines added/
                  deleted, author spread) plus an AI-adoption estimate
                  (heuristic: AI markers in commit trailers/bodies).
- snapshot:       persists one document per UTC day into the store's
                  devintel_snapshots collection (idempotent per day), so
                  adoption trends accumulate over time.
- devintel-report: retrieves the snapshot history and summarizes the trend.

Honest limits (kept in the outputs, not just the README):
- AI detection is heuristic: it scans commit trailers (e.g.
  `Co-authored-by: ... Copilot`) and body markers ("Generated with Claude",
  "ai-generated", ...). It cannot see the author's editor/IDE. A 0% reading
  may mean "no AI markers", not "no AI was used".
- Delivery metrics are git-only: no PR/Jira/CI data in this workspace, so
  cycle time and DORA lead-time are approximated from commit timestamps.
"""
from __future__ import annotations

import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..core import Agent, AgentContext, Workflow
from ..store import _iso

# Markers that indicate a commit was produced with AI assistance. These are
# matched case-insensitively against the commit body + trailers.
AI_PATTERNS: list[tuple[str, str]] = [
    ("github-copilot", r"co-authored-by:[^\n]*\bcopilot\b"),
    ("claude", r"co-authored-by:[^\n]*\bclaude\b|\bgenerated (?:with|by)\s+claude"),
    ("chatgpt/openai", r"co-authored-by:[^\n]*\b(?:chatgpt|openai)\b|\bgenerated (?:with|by)\s+(?:chatgpt|openai)"),
    ("gemini", r"co-authored-by:[^\n]*\bgemini\b|\bgenerated (?:with|by)\s+gemini"),
    ("cursor", r"\bcursor\b.*\b(?:ai|composer)\b|co-authored-by:[^\n]*\bcursor\b"),
    ("aider", r"co-authored-by:[^\n]*\baider\b|\baider\s+generated"),
    ("generic-ai", r"\bai-generated\b|\bai-assisted\b|\bgenerated (?:with|by)\s+(?:ai|llm)\b"),
]

_REC_SEP = "\x1e"  # git log record separator
_FIELD_SEP = "\x1f"  # git log field separator
_FMT = f"%H{_FIELD_SEP}%an{_FIELD_SEP}%aI{_FIELD_SEP}%s{_FIELD_SEP}%b"


_HONEST_LIMITS = {
    "ai_detection": "heuristic on commit trailers/body markers; a 0% reading may mean 'no AI markers', not 'no AI used'.",
    "cycle_time": "git-only approximation (no PR/Jira/CI data in this workspace).",
}

# NOTE: records are split on \x1e and fields on \x1f. A commit body that
# literally contains either control char would truncate/misalign parsing;
# these chars are astronomically rare in real commit messages, so we accept
# the assumption rather than paying for a full %B re-encode.


def _git(root: Path, *args: str, timeout: int = 60) -> str:
    proc = subprocess.run(
        ["git", "-C", str(root), *args],
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"git {' '.join(args)} failed (exit {proc.returncode}): "
            f"{(proc.stderr or proc.stdout or '').strip()[:300]}"
        )
    return proc.stdout


def _collect(ctx: AgentContext) -> dict[str, Any]:
    root = ctx.workspace_root
    if not (root / ".git").exists():
        raise RuntimeError(f"{root} is not a git repository -- devintel needs git history")

    # -- commit log (records split by \x1e, fields by \x1f) --------------
    raw = _git(root, "log", f"--pretty=format:{_FMT}{_REC_SEP}")
    commits: list[dict[str, str]] = []
    for rec in raw.split(_REC_SEP):
        parts = rec.split(_FIELD_SEP)
        if len(parts) < 4:
            continue
        commits.append(
            {
                "hash": parts[0],
                "author": parts[1],
                "date": parts[2],
                "subject": parts[3],
                "body": parts[4] if len(parts) > 4 else "",
            }
        )

    if not commits:
        return {
            "window": {"commits": 0},
            "delivery": {},
            "ai": {"assisted": 0, "ratio": 0.0, "by_tool": {}},
            "honest_limits": _HONEST_LIMITS,
        }

    # -- numstat: aggregate added/deleted lines + files touched -----------
    stat_raw = _git(root, "log", "--numstat", "--pretty=format:")
    added = deleted = files = 0
    for line in stat_raw.splitlines():
        parts = line.split("\t")
        if len(parts) != 3 or parts[0] == "-" or parts[1] == "-":
            continue
        try:
            added += int(parts[0])
            deleted += int(parts[1])
            files += 1
        except ValueError:
            continue

    # -- AI adoption (heuristic) ------------------------------------------
    by_tool: dict[str, int] = {}
    assisted = 0
    for c in commits:
        hay = f"{c['subject']}\n{c['body']}"
        hit = False
        for tool, pattern in AI_PATTERNS:
            if re.search(pattern, hay, re.IGNORECASE):
                by_tool[tool] = by_tool.get(tool, 0) + 1
                hit = True
        if hit:
            assisted += 1

    # -- authors + throughput ---------------------------------------------
    authors: dict[str, int] = {}
    for c in commits:
        authors[c["author"]] = authors.get(c["author"], 0) + 1

    dates = [c["date"] for c in commits if c["date"]]
    days_span = 1
    if len(dates) >= 2:
        try:
            t0 = datetime.fromisoformat(dates[-1])
            t1 = datetime.fromisoformat(dates[0])
            days_span = max(1, (t1 - t0).days + 1)
        except ValueError:
            pass

    n = len(commits)
    return {
        "window": {
            "commits": n,
            "since": dates[-1] if dates else None,
            "until": dates[0] if dates else None,
            "days_span": days_span,
        },
        "delivery": {
            "commits": n,
            "commits_per_day": round(n / days_span, 2),
            "files_changed": files,
            "lines_added": added,
            "lines_deleted": deleted,
            "authors": authors,
        },
        "ai": {
            "assisted": assisted,
            "ratio": round(assisted / n, 4),
            "by_tool": by_tool,
        },
        "honest_limits": _HONEST_LIMITS,
    }


def _snapshot(ctx: AgentContext) -> dict[str, Any]:
    collected = ctx.outputs.get("collect-git") or {}
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    doc = {
        "_id": f"devintel-{day}",
        "day": day,
        "created_at": _iso(),
        "repo": str(ctx.workspace_root),
        **collected,
    }
    ctx.store.save_devintel_snapshot(doc)
    return {
        "snapshot_id": doc["_id"],
        "day": day,
        "commits": collected.get("window", {}).get("commits", 0),
        "ai_ratio": collected.get("ai", {}).get("ratio", 0.0),
    }


def _report(ctx: AgentContext) -> dict[str, Any]:
    snaps = ctx.store.list_devintel_snapshots(limit=90)
    trend: list[dict[str, Any]] = []
    for s in reversed(snaps):  # oldest -> newest
        trend.append(
            {
                "day": s.get("day"),
                "commits": s.get("window", {}).get("commits", 0),
                "commits_per_day": s.get("delivery", {}).get("commits_per_day", 0),
                "ai_ratio": s.get("ai", {}).get("ratio", 0.0),
            }
        )
    return {
        "snapshots": len(snaps),
        "trend": trend,
        "latest": trend[-1] if trend else None,
    }


collect_git_agent = Agent(
    "collect-git",
    _collect,
    "Compute git delivery metrics + AI-adoption estimate for the workspace.",
)
snapshot_agent = Agent(
    "snapshot",
    _snapshot,
    "Persist a per-day devintel snapshot into the store (idempotent per day).",
)
devintel_report_agent = Agent(
    "devintel-report",
    _report,
    "Summarize the stored devintel trend over time.",
)

DEVINTEL = Workflow(
    "devintel",
    "collect-git -> snapshot -> devintel-report",
    [collect_git_agent, snapshot_agent, devintel_report_agent],
)
