"""Entry point: `python -m malkom_langgraph`.

Reads the one `start` message from the bridge, then runs the agent for that
case:

- If MALKOM_LG_AGENT points at a Python file (a studio draft), that file's
  `run(ctx)` is the agent — the developer's own LangGraph, edited in the studio.
- Otherwise the engine's built-in manifest-driven graph runs.

Either way the ending is handed out through the bridge. Any error becomes a
handover so the case reaches a person rather than vanishing.
"""

from __future__ import annotations

import importlib.util
import os
import sys
import traceback
from types import ModuleType

from .agent import run_manifest_agent
from .bridge import Bridge
from .context import Context


def _load_agent_module(path: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location("malkom_studio_agent", path)
    if spec is None or spec.loader is None:
        raise ImportError(f"could not load the agent file at {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> None:
    bridge = Bridge()
    start = bridge.read_start()
    ctx = Context(start, bridge)
    try:
        agent_file = os.environ.get("MALKOM_LG_AGENT", "")
        if agent_file != "":
            module = _load_agent_module(agent_file)
            if not hasattr(module, "run"):
                raise AttributeError("the agent file must define run(ctx)")
            module.run(ctx)
        else:
            run_manifest_agent(ctx)
    except Exception as error:  # noqa: BLE001 — the case must still reach a person
        traceback.print_exc(file=sys.stderr)
        bridge.end(
            {
                "ending": "handover",
                "whyStopped": f"The LangGraph agent hit an error: {error}",
                "fields": {},
                "confidence": {},
                "tried": [],
                "notes": [],
            }
        )


if __name__ == "__main__":
    main()
