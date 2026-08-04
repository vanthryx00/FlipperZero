"""Concrete agents that operate on this Flipper Zero workspace."""
from .workspace import (  # noqa: F401
    PIPELINE,
    WORKFLOWS,
    curate_agent,
    report_agent,
    sync_plan_agent,
    validate_agent,
)
from .flipper_ai import (  # noqa: F401
    FLIPPER_AI_WORKFLOWS,
    analyze_payload_agent,
    fix_payload_agent,
    generate_badusb_agent,
    generate_ir_agent,
)
