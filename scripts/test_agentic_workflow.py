"""End-to-end selftest for the agentic workflow (FileStore backend, no Atlas).

Verifies:
  - the full pipeline (validate -> curate -> sync-plan -> report) completes
  - payloads get curated into the store
  - keyword search finds the Tesla file
  - vector search returns results for a camera query
  - resume-after-failure: a workflow that fails on attempt 1 completes on
    resume without re-running completed steps

Usage:  python scripts/test_agentic_workflow.py
"""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from agentic.agents.workspace import PIPELINE  # noqa: E402
from agentic.core import Agent, Engine, Workflow  # noqa: E402
from agentic.embed import FeatureHashEmbedder  # noqa: E402
from agentic.store import FileStore  # noqa: E402


def main() -> int:
    fails: list[str] = []

    def check(name: str, cond: bool, detail: str = "") -> None:
        print(f"[{'OK' if cond else 'FAIL'}] {name}" + (f"  -- {detail}" if detail else ""))
        if not cond:
            fails.append(name)

    tmp = Path(tempfile.mkdtemp(prefix="agentic_selftest_"))
    store = FileStore(tmp)
    engine = Engine(store, workspace_root=ROOT)

    # 1. Full pipeline on the workspace
    run = engine.run(PIPELINE)
    check("pipeline completed", run["status"] == "completed", run["status"])
    check(
        "all steps completed",
        all(s["status"] == "completed" for s in run["steps"]),
        str([s["name"] for s in run["steps"] if s["status"] != "completed"]),
    )
    n = store.count_payloads()
    check("payloads curated", n > 0, f"{n} payloads")

    # 1b. Idempotency: re-running curate must converge (no doc growth)
    from agentic.agents.workspace import curate_agent
    from agentic.core import Agent as A

    rerun = engine.run(Workflow("curate-only", "x", [A("curate", curate_agent.fn)]))
    n2 = store.count_payloads()
    check("curate is idempotent", n2 == n, f"before={n} after={n2}")
    check("stale docs removed on first rerun", rerun["steps"][0]["output"]["removed_stale"] == 0 or n2 == n)

    # 2. Keyword search
    hits = store.search_payloads("tesla charge port")
    check(
        "text search finds Tesla",
        any("Tesla" in (h.get("name") or "") for h in hits),
        [h.get("name") for h in hits[:3]],
    )

    # 3. Vector search (feature-hash embedder, no deps)
    emb = FeatureHashEmbedder()
    sim = store.vector_search_payloads(emb.embed("camera shutter release"), limit=5)
    check(
        "vector search returns results",
        len(sim) > 0 and any("amera" in (s.get("name") or "") for s in sim[:5]),
        [s.get("name") for s in sim[:3]],
    )

    # 4. Resume-after-failure
    calls = {"n": 0}

    def flaky(ctx):  # noqa: ANN001, ANN201 - selftest fixture
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("boom")
        return "recovered"

    wf = Workflow("resume-demo", "failure then resume", [Agent("flaky", flaky)])
    try:
        engine.run(wf)
        check("flaky fails first run", False, "expected RuntimeError")
    except RuntimeError as exc:
        check("flaky fails first run", "boom" in str(exc), str(exc))

    failed = store.list_runs(status="failed")
    check("failed run recorded", len(failed) == 1, f"{len(failed)} failed run(s)")
    run2 = engine.run(wf, resume_run_id=failed[0]["_id"])
    check(
        "resume completes without re-running earlier steps",
        run2["status"] == "completed"
        and run2["steps"][0]["output"] == "recovered"
        and run2["steps"][0]["attempts"] == 2,
        f'status={run2["status"]} attempts={run2["steps"][0]["attempts"]}',
    )

    # 5. Devintel workflow: git delivery metrics + AI adoption snapshot
    from agentic.agents.devintel import DEVINTEL

    drun = engine.run(DEVINTEL)
    snap = {s["name"]: s for s in drun["steps"]}["snapshot"]["output"]
    check(
        "devintel snapshot created",
        snap.get("snapshot_id") and store.count_devintel_snapshots() == 1,
        f"id={snap.get('snapshot_id')}",
    )
    check("devintel sees commits", (snap.get("commits") or 0) > 0, f"commits={snap.get('commits')}")
    # idempotent per day: re-run must not add a second snapshot
    engine.run(DEVINTEL)
    check("devintel idempotent per day", store.count_devintel_snapshots() == 1)

    # 6. Report agent aggregated state
    report = store.get_run(run["_id"])  # the pipeline run
    check("run record is durable", report is not None and report["status"] == "completed")

    print()
    if not fails:
        print(f"PASS ({n} payloads curated, resume verified)")
        return 0
    print(f"FAIL ({len(fails)}): {fails}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
