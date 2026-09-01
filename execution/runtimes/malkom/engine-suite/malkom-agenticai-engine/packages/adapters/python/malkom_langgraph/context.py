"""The connection an agent's `run(ctx)` receives.

A LangGraph agent written in the studio edits `run(ctx)`. `ctx` is the whole
connection: the case and the goal to read, the tools to call, and the way to
end. Every tool call goes through the real gateway; every report is written to
the real event log; the ending is one of exactly four. The agent decides its
own steps — `ctx` never decides for it.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .bridge import Bridge


class Context:
    def __init__(self, start: dict[str, Any], bridge: Bridge) -> None:
        self.start = start
        self.manifest: dict[str, Any] = start["manifest"]
        self.case: dict[str, Any] = start["case"]
        self.tools: list[dict[str, Any]] = start.get("tools", [])
        self.shadow: bool = start.get("shadow", False)
        self.provider = start.get("provider")
        self._bridge = bridge

    def call(self, tool: str, args: dict[str, Any] | None = None) -> Any:
        """Call a gateway tool. Returns its reply, or {'refused': why} if refused."""
        reply = self._bridge.call(tool, args or {})
        return reply.get("reply") if reply.get("ok") else {"refused": reply.get("refused")}

    def note(self, text: str) -> None:
        """Say what you are doing, in one plain sentence — recorded on the timeline."""
        self._bridge.report(
            {"type": "noted", "at": datetime.now(timezone.utc).isoformat(), "step": 0, "note": text}
        )

    def report(self, event: dict[str, Any]) -> None:
        """Write a run event to the event log, before the next step starts."""
        self._bridge.report(event)

    def end(self, ending: str = "done", **fields: Any) -> None:
        """End the run — one of done / question / handover / parked."""
        self._bridge.end({"ending": ending, **fields})
