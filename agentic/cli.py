"""Command-line interface: python -m agentic <command>.

Commands:
    run WORKFLOW   Run a workflow (validate | curate | sync-plan | report | pipeline | devintel)
                   [--resume RUN_ID] to continue a failed run from its checkpoint
    runs           List recent workflow runs [--status X] [--limit N]
    show RUN_ID    Dump a run's steps, outputs and errors
    search QUERY   Keyword search over curated payloads ($text / local scoring)
    vector TEXT    Vector similarity search over curated payloads
    flipper-ai     AI toolkit: generate/analyze/fix Flipper Zero payloads via LLM
    indexes        Create standard (+ Atlas Search/Vector Search) indexes
    doctor         Backend health + index status
"""
from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from .agents.flipper_ai import FLIPPER_AI_WORKFLOWS
from .agents.workspace import WORKFLOWS
from .core import Engine
from .embed import get_embedder
from .retrieval import recent_runs, store_health
from .store import StoreFeatureError, get_store


def _pp(obj: Any, indent: int = 2) -> str:
    return json.dumps(obj, indent=indent, default=str, ensure_ascii=False)


def _print_run(run: dict[str, Any]) -> None:
    print(f"run      : {run['_id']}  ({run.get('workflow')})")
    print(f"status   : {run.get('status')}")
    print(f"created  : {run.get('created_at')}   finished: {run.get('finished_at') or '-'}")
    for step in run.get("steps", []):
        line = (
            f"  - {step['name']:<10} {step['status']:<10} "
            f"attempts={step.get('attempts', 0)} "
            f"duration={step.get('duration_ms')}ms"
        )
        if step.get("error"):
            line += f"  ERROR: {step['error'][:200]}"
        print(line)


def _cmd_run(args: argparse.Namespace) -> int:
    store = get_store()
    engine = Engine(store)
    wf = WORKFLOWS[args.workflow]
    try:
        run = engine.run(wf, resume_run_id=args.resume)
    except (RuntimeError, ValueError) as exc:
        print(f"workflow failed: {exc}", file=sys.stderr)
        return 1
    if args.json:
        print(_pp(run))
    else:
        _print_run(run)
    return 0 if run["status"] == "completed" else 1


def _cmd_runs(args: argparse.Namespace) -> int:
    store = get_store()
    for r in recent_runs(store, limit=args.limit, status=args.status):
        print(f"{r['_id']}  {r.get('workflow'):<12} {r.get('status'):<10} {r.get('created_at')}")
    return 0


def _cmd_show(args: argparse.Namespace) -> int:
    store = get_store()
    run = store.get_run(args.run_id)
    if not run:
        print(f"run {args.run_id} not found", file=sys.stderr)
        return 1
    if args.json:
        print(_pp(run))
        return 0
    _print_run(run)
    for step in run.get("steps", []):
        out = step.get("output")
        if out is not None:
            print(f"\n-- {step['name']} output --")
            print(_pp(out)[:4000])
    return 0


def _cmd_search(args: argparse.Namespace) -> int:
    store = get_store()
    try:
        hits = store.search_payloads(args.query, limit=args.limit)
    except StoreFeatureError as exc:
        print(f"search unavailable: {exc}", file=sys.stderr)
        return 1
    for h in hits:
        print(f"{h.get('score', '-')}  {h.get('kind'):<10} {h.get('name')}")
    print(f"\n{len(hits)} result(s) for {args.query!r}")
    return 0


def _cmd_vector(args: argparse.Namespace) -> int:
    store = get_store()
    embedder = get_embedder()
    try:
        hits = store.vector_search_payloads(embedder.embed(args.text), limit=args.limit)
    except StoreFeatureError as exc:
        print(f"vector search unavailable: {exc}", file=sys.stderr)
        return 1
    for h in hits:
        print(f"{h.get('kind'):<10} {h.get('name')}")
    print(f"\n{len(hits)} result(s) for {args.text!r} (embedder={embedder.name})")
    return 0


def _cmd_devintel(_args: argparse.Namespace) -> int:
    """Run the devintel workflow: collect git metrics, snapshot, report trend."""
    store = get_store()
    engine = Engine(store)
    wf = WORKFLOWS["devintel"]
    try:
        run = engine.run(wf)
    except (RuntimeError, ValueError) as exc:
        print(f"devintel failed: {exc}", file=sys.stderr)
        return 1
    by_name = {s["name"]: s for s in run["steps"]}
    snap = by_name["snapshot"]["output"]
    report = by_name["devintel-report"]["output"]
    print(f"snapshot : {snap.get('snapshot_id')}  ({snap.get('day')})")
    print(f"commits  : {snap.get('commits')}   ai_ratio: {snap.get('ai_ratio')}")
    print(f"snapshots in store: {report.get('snapshots')}")
    latest = report.get("latest")
    if latest:
        print("\ntrend (day, commits, commits/day, ai_ratio):")
        for t in report.get("trend", [])[-10:]:
            print(f"  {t['day']}  c={t['commits']:<5} c/d={t['commits_per_day']:<6} ai={t['ai_ratio']}")
    return 0 if run["status"] == "completed" else 1


def _cmd_devintel_trend(args: argparse.Namespace) -> int:
    """Retrieve stored devintel snapshots (the adoption curve over time)."""
    store = get_store()
    snaps = store.list_devintel_snapshots(limit=args.days)
    if not snaps:
        print("no devintel snapshots yet -- run 'python -m agentic devintel' first")
        return 1
    print(f"{'day':<12} {'commits':<9} {'c/day':<7} {'ai_ratio':<9} tool-breakdown")
    for s in reversed(snaps):
        ai = s.get("ai", {})
        tools = ", ".join(f"{k}={v}" for k, v in (ai.get("by_tool") or {}).items()) or "-"
        print(
            f"{s.get('day',''):<12} {s.get('window',{}).get('commits',0):<9} "
            f"{s.get('delivery',{}).get('commits_per_day',0):<7} "
            f"{ai.get('ratio',0.0):<9} {tools}"
        )
    return 0


def _cmd_indexes(_args: argparse.Namespace) -> int:
    from .setup_indexes import main as setup_main

    return setup_main()


def _cmd_doctor(_args: argparse.Namespace) -> int:
    store = get_store()
    print(_pp(store_health(store)))
    if store.backend == "atlas":
        print("\nTip: 'python -m agentic indexes' creates text + vector indexes.")
    else:
        print(
            "\nLocal FileStore in use. Set MONGODB_URI to persist to MongoDB Atlas."
        )
    return 0


def _cmd_flipper_ai(args: argparse.Namespace) -> int:
    """Run a Flipper AI workflow (generate-badusb, analyze, generate-ir, generate-subghz, generate-rfid, generate-nfc, fix, chat)."""
    cmd = args.fai_cmd

    # ── chat --stream: bypass workflow engine, print tokens as they arrive ──
    if cmd == "chat" and getattr(args, "stream", False):
        from .llm_client import LLMClient

        if getattr(args, "json", False):
            print("note: --json is ignored with --stream", file=sys.stderr)

        client = LLMClient()
        print(f"╭─ {client.model} @ {client.base_url}", file=sys.stderr)
        print("│", file=sys.stderr)
        try:
            for token in client.chat_stream(
                args.prompt,
                system=getattr(args, "system", None),
                max_tokens=getattr(args, "max_tokens", 2048),
            ):
                print(token, end="", flush=True)
            print()  # final newline
        except RuntimeError as exc:
            print(f"\nstream failed: {exc}", file=sys.stderr)
            return 1
        print("╰─ end", file=sys.stderr)
        return 0

    # Map CLI commands to workflow names
    wf_map = {
        "generate-badusb": "generate-badusb",
        "analyze": "analyze-payload",
        "generate-ir": "generate-ir",
        "generate-subghz": "generate-subghz",
        "generate-rfid": "generate-rfid",
        "generate-nfc": "generate-nfc",
        "fix": "fix-payload",
        "chat": "chat",
    }
    wf_name = wf_map[cmd]

    store = get_store()
    engine = Engine(store)
    wf = FLIPPER_AI_WORKFLOWS[wf_name]

    output_path = getattr(args, "output_path", None)

    inputs: dict[str, Any] = {}
    if cmd == "generate-badusb":
        inputs["description"] = args.description
        inputs["target_os"] = args.target_os
        inputs["author"] = args.author
        if output_path:
            inputs["output_path"] = output_path
    elif cmd == "analyze":
        inputs["file"] = args.file
    elif cmd == "generate-ir":
        inputs["description"] = args.description
        inputs["frequency"] = args.frequency
        inputs["protocol"] = args.protocol
        if output_path:
            inputs["output_path"] = output_path
    elif cmd == "fix":
        inputs["file"] = args.file
        if output_path:
            inputs["output_path"] = output_path
    elif cmd == "generate-subghz":
        inputs["description"] = args.description
        inputs["frequency"] = args.frequency
        inputs["preset"] = args.preset
        if output_path:
            inputs["output_path"] = output_path
    elif cmd == "generate-rfid":
        inputs["description"] = args.description
        inputs["frequency"] = args.frequency
        inputs["key_type"] = args.key_type
        if output_path:
            inputs["output_path"] = output_path
    elif cmd == "generate-nfc":
        inputs["description"] = args.description
        inputs["frequency"] = args.frequency
        inputs["protocol"] = args.protocol
        inputs["uid_size"] = args.uid_size
        if output_path:
            inputs["output_path"] = output_path
    elif cmd == "chat":
        inputs["prompt"] = args.prompt
        if getattr(args, "system", None):
            inputs["system"] = args.system
        inputs["max_tokens"] = getattr(args, "max_tokens", 2048)

    try:
        run = engine.run(wf, inputs=inputs)
    except (RuntimeError, ValueError) as exc:
        print(f"flipper-ai {cmd} failed: {exc}", file=sys.stderr)
        return 1

    if getattr(args, "json", False):
        print(_pp(run))
        return 0 if run["status"] == "completed" else 1

    # Human-readable output
    output = run["steps"][0].get("output", {}) if run.get("steps") else {}

    if cmd == "generate-badusb":
        script = output.get("script", "")
        if output.get("output_path"):
            print(f"[OK] Written to {output['output_path']} ({output.get('chars', 0)} chars)")
        else:
            print(script)
    elif cmd == "analyze":
        print(output.get("analysis", "No analysis returned."))
    elif cmd == "generate-ir":
        ir = output.get("ir_content", "")
        if output.get("output_path"):
            print(f"[OK] Written to {output['output_path']} ({output.get('chars', 0)} chars)")
        else:
            print(ir)
    elif cmd == "fix":
        fixed = output.get("fixed_content", "")
        if output.get("output_path"):
            print(f"✓ Written fixed version to {output['output_path']} ({output.get('fixed_chars', 0)} chars)")
        else:
            print(fixed)
    elif cmd == "generate-subghz":
        sub = output.get("sub_content", "")
        if output.get("output_path"):
            print(f"[OK] Written to {output['output_path']} ({output.get('chars', 0)} chars)")
        else:
            print(sub)
    elif cmd == "generate-rfid":
        rfid = output.get("rfid_content", "")
        if output.get("output_path"):
            print(f"[OK] Written to {output['output_path']} ({output.get('chars', 0)} chars)")
        else:
            print(rfid)
    elif cmd == "generate-nfc":
        nfc = output.get("nfc_content", "")
        if output.get("output_path"):
            print(f"[OK] Written to {output['output_path']} ({output.get('chars', 0)} chars)")
        else:
            print(nfc)
    elif cmd == "chat":
        print(output.get("reply", ""))

    return 0 if run["status"] == "completed" else 1


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        prog="python -m agentic",
        description="Durable, queryable agent orchestration (MongoDB Atlas + local fallback).",
    )
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_run = sub.add_parser("run", help="Run a workflow")
    p_run.add_argument("workflow", choices=sorted(WORKFLOWS))
    p_run.add_argument("--resume", metavar="RUN_ID", help="resume a failed run from its checkpoint")
    p_run.add_argument("--json", action="store_true", help="dump the full run record as JSON")
    p_run.set_defaults(fn=_cmd_run)

    p_runs = sub.add_parser("runs", help="List recent workflow runs")
    p_runs.add_argument("--status", choices=["running", "completed", "failed"])
    p_runs.add_argument("--limit", type=int, default=20)
    p_runs.set_defaults(fn=_cmd_runs)

    p_show = sub.add_parser("show", help="Show a run's steps and outputs")
    p_show.add_argument("run_id")
    p_show.add_argument("--json", action="store_true")
    p_show.set_defaults(fn=_cmd_show)

    p_search = sub.add_parser("search", help="Keyword search over curated payloads")
    p_search.add_argument("query")
    p_search.add_argument("--limit", type=int, default=10)
    p_search.set_defaults(fn=_cmd_search)

    p_vector = sub.add_parser("vector", help="Vector similarity search over curated payloads")
    p_vector.add_argument("text")
    p_vector.add_argument("--limit", type=int, default=5)
    p_vector.set_defaults(fn=_cmd_vector)

    p_dev = sub.add_parser("devintel", help="Collect git delivery metrics + AI adoption, snapshot, report trend")
    p_dev.set_defaults(fn=_cmd_devintel)

    p_trend = sub.add_parser("devintel-trend", help="Retrieve the stored devintel snapshot history")
    p_trend.add_argument("--days", type=int, default=90, help="max snapshots to show")
    p_trend.set_defaults(fn=_cmd_devintel_trend)

    sub.add_parser("indexes", help="Create standard + Atlas Search/Vector indexes").set_defaults(fn=_cmd_indexes)
    sub.add_parser("doctor", help="Backend health + index status").set_defaults(fn=_cmd_doctor)

    # ── flipper-ai ───────────────────────────────────────────────────
    p_fai = sub.add_parser("flipper-ai", help="AI toolkit: generate/analyze/fix Flipper Zero payloads via LLM")
    fai_sub = p_fai.add_subparsers(dest="fai_cmd", required=True)

    p_gen = fai_sub.add_parser("generate-badusb", help="Generate a BadUSB script from a description")
    p_gen.add_argument("description", help="What the BadUSB script should do")
    p_gen.add_argument("--target-os", default="Windows", help="Target OS (default: Windows)")
    p_gen.add_argument("--author", default="AI-generated", help="Author name for the script header")
    p_gen.add_argument("--output", dest="output_path", help="Path to write the generated script")
    p_gen.add_argument("--json", action="store_true")
    p_gen.set_defaults(fn=_cmd_flipper_ai)

    p_analyze = fai_sub.add_parser("analyze", help="Analyze a payload file and explain what it does")
    p_analyze.add_argument("file", help="Path to the payload file (relative to repo root or absolute)")
    p_analyze.add_argument("--json", action="store_true")
    p_analyze.set_defaults(fn=_cmd_flipper_ai)

    p_ir = fai_sub.add_parser("generate-ir", help="Generate an IR signal file from a device description")
    p_ir.add_argument("description", help="What device/signal to generate IR for")
    p_ir.add_argument("--frequency", type=int, default=38000, help="Carrier frequency in Hz (default: 38000)")
    p_ir.add_argument("--protocol", default="raw", help="Protocol type (default: raw)")
    p_ir.add_argument("--output", dest="output_path", help="Path to write the generated .ir file")
    p_ir.add_argument("--json", action="store_true")
    p_ir.set_defaults(fn=_cmd_flipper_ai)

    p_fix = fai_sub.add_parser("fix", help="Review a payload for issues and output a corrected version")
    p_fix.add_argument("file", help="Path to the payload file to fix")
    p_fix.add_argument("--output", dest="output_path", help="Path to write the fixed payload")
    p_fix.add_argument("--json", action="store_true")
    p_fix.set_defaults(fn=_cmd_flipper_ai)

    p_sub = fai_sub.add_parser("generate-subghz", help="Generate a SubGHz RAW file from a description")
    p_sub.add_argument("description", help="What device/signal to generate SubGHz for")
    p_sub.add_argument("--frequency", type=int, default=433920000, help="Frequency in Hz (default: 433920000 = 433.92 MHz)")
    p_sub.add_argument("--preset", default="FuriHalSubGhzPresetOok650Async", help="Radio preset (default: Ook650Async)")
    p_sub.add_argument("--output", dest="output_path", help="Path to write the generated .sub file")
    p_sub.add_argument("--json", action="store_true")
    p_sub.set_defaults(fn=_cmd_flipper_ai)

    p_rfid = fai_sub.add_parser("generate-rfid", help="Generate an RFID emulation file from a description")
    p_rfid.add_argument("description", help="What kind of RFID tag to generate")
    p_rfid.add_argument("--frequency", type=int, default=125000, help="Frequency in Hz (default: 125000 = 125 kHz)")
    p_rfid.add_argument("--key-type", default="EM4100", help="RFID protocol (default: EM4100)")
    p_rfid.add_argument("--output", dest="output_path", help="Path to write the generated .rfid file")
    p_rfid.add_argument("--json", action="store_true")
    p_rfid.set_defaults(fn=_cmd_flipper_ai)

    p_nfc = fai_sub.add_parser("generate-nfc", help="Generate an NFC emulation file from a card description")
    p_nfc.add_argument("description", help="What kind of NFC tag/card to generate")
    p_nfc.add_argument("--frequency", type=int, default=13560000, help="Frequency in Hz (default: 13560000 = 13.56 MHz)")
    p_nfc.add_argument("--protocol", default="Mifare Classic", help="Card type: Mifare Classic, NTAG213, NTAG215, NTAG216, Mifare Ultralight (default: Mifare Classic)")
    p_nfc.add_argument("--uid-size", type=int, default=4, choices=[4, 7], help="UID size in bytes: 4 for Mifare Classic, 7 for NTAG/Ultralight (default: 4)")
    p_nfc.add_argument("--output", dest="output_path", help="Path to write the generated .nfc file")
    p_nfc.add_argument("--json", action="store_true")
    p_nfc.set_defaults(fn=_cmd_flipper_ai)

    p_chat = fai_sub.add_parser("chat", help="Send a raw prompt to the LLM")
    p_chat.add_argument("prompt", help="The prompt to send")
    p_chat.add_argument("--system", help="System prompt")
    p_chat.add_argument("--max-tokens", type=int, default=2048)
    p_chat.add_argument("--stream", action="store_true", help="Stream tokens as they arrive")
    p_chat.add_argument("--json", action="store_true")
    p_chat.set_defaults(fn=_cmd_flipper_ai)

    args = ap.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
