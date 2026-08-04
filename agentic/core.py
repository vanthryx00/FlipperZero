"""Small, dependency-free agent orchestration engine with durable state.

A Workflow is an ordered list of Agent steps. The Engine executes them,
persisting every transition to a Store (Atlas or the local file fallback),
so a run can be inspected at any time, resumed after a failure, and audited
afterwards from the stored checkpoints.
"""
from __future__ import annotations

import time
from pathlib import Path
from typing import Any, Callable

from .store import _iso, REPO_ROOT


class AgentContext:
    """Everything an agent step is allowed to touch."""

    def __init__(
        self,
        store: Any,
        run_id: str,
        workflow_name: str,
        inputs: dict[str, Any],
        outputs: dict[str, Any],
        workspace_root: Path,
    ) -> None:
        self.store = store
        self.run_id = run_id
        self.workflow_name = workflow_name
        self.inputs = inputs
        self.outputs = outputs  # outputs of steps that already completed
        self.workspace_root = workspace_root

    def log(self, message: str) -> None:
        print(f"[agent:{self.workflow_name}:{self.run_id}] {message}")


class Agent:
    """One step in a workflow: a named, re-runnable unit of work."""

    def __init__(self, name: str, fn: Callable[[AgentContext], Any], description: str = "") -> None:
        self.name = name
        self.fn = fn
        self.description = description


class Workflow:
    """An ordered list of agent steps executed with durable checkpoints."""

    def __init__(self, name: str, description: str, steps: list[Agent]) -> None:
        self.name = name
        self.description = description
        self.steps = steps


class Engine:
    """Executes Workflows against a Store, checkpointing after every step.

    On failure the run is persisted as 'failed' and a RuntimeError is raised;
    call run(workflow, resume_run_id=...) to continue from the failed step
    (completed steps are replayed from their stored outputs, not re-run).
    """

    def __init__(self, store: Any, workspace_root: Path | str | None = None) -> None:
        self.store = store
        self.workspace_root = Path(workspace_root) if workspace_root else REPO_ROOT

    def run(
        self,
        workflow: Workflow,
        inputs: dict[str, Any] | None = None,
        resume_run_id: str | None = None,
    ) -> dict[str, Any]:
        inputs = inputs or {}
        if resume_run_id:
            run = self.store.get_run(resume_run_id)
            if not run:
                raise ValueError(f"run {resume_run_id} not found in store")
            if run["status"] == "completed":
                raise ValueError(f"run {resume_run_id} is already completed")
            outputs = {
                s["name"]: s["output"]
                for s in run["steps"]
                if s.get("status") == "completed" and s.get("output") is not None
            }
        else:
            run = {
                "_id": None,
                "workflow": workflow.name,
                "description": workflow.description,
                "status": "running",
                "inputs": inputs,
                "steps": [
                    {
                        "name": a.name,
                        "description": a.description,
                        "status": "pending",
                        "attempts": 0,
                        "started_at": None,
                        "finished_at": None,
                        "duration_ms": None,
                        "output": None,
                        "error": None,
                    }
                    for a in workflow.steps
                ],
                "created_at": _iso(),
                "updated_at": _iso(),
                "finished_at": None,
            }
            run["_id"] = self.store.save_run(run)
            outputs: dict[str, Any] = {}

        run_id = run["_id"]
        ctx = AgentContext(
            self.store, run_id, workflow.name, inputs, outputs, self.workspace_root
        )
        step_map = {a.name: a for a in workflow.steps}

        for step in run["steps"]:
            if step["status"] == "completed":
                continue  # checkpointed already -- don't re-run on resume
            agent = step_map[step["name"]]
            step["status"] = "running"
            step["attempts"] = (step.get("attempts") or 0) + 1
            step["started_at"] = _iso()
            t0 = time.monotonic()
            run["status"] = "running"
            run["updated_at"] = _iso()
            self.store.update_run(run_id, {"status": run["status"], "steps": run["steps"]})
            try:
                output = agent.fn(ctx)
            except Exception as exc:
                step["status"] = "failed"
                step["error"] = f"{type(exc).__name__}: {exc}"
                step["finished_at"] = _iso()
                step["duration_ms"] = int((time.monotonic() - t0) * 1000)
                run["status"] = "failed"
                run["finished_at"] = _iso()
                run["updated_at"] = _iso()
                self.store.update_run(
                    run_id,
                    {
                        "status": run["status"],
                        "finished_at": run["finished_at"],
                        "updated_at": run["updated_at"],
                        "steps": run["steps"],
                    },
                )
                ctx.log(f"step {agent.name!r} FAILED: {step['error']}")
                raise RuntimeError(
                    f"workflow {workflow.name} failed at step {agent.name!r}: {step['error']}"
                ) from exc
            step["status"] = "completed"
            step["output"] = output
            step["finished_at"] = _iso()
            step["duration_ms"] = int((time.monotonic() - t0) * 1000)
            outputs[agent.name] = output
            ctx.outputs = outputs
            run["updated_at"] = _iso()
            self.store.update_run(run_id, {"steps": run["steps"], "updated_at": run["updated_at"]})
            ctx.log(f"step {agent.name!r} completed in {step['duration_ms']}ms")

        run["status"] = "completed"
        run["finished_at"] = _iso()
        run["updated_at"] = _iso()
        self.store.update_run(
            run_id,
            {"status": "completed", "finished_at": run["finished_at"], "updated_at": run["updated_at"]},
        )
        ctx.log(f"workflow {workflow.name!r} completed")
        return self.store.get_run(run_id)  # type: ignore[return-value]
