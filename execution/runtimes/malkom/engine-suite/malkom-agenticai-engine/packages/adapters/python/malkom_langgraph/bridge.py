"""The bridge — newline-delimited JSON over stdin/stdout.

The TypeScript adapter (`langgraphAdapter`) holds the real runner, gateway,
pass and event log. This bridge is the Python side of that one channel: the
agent's every tool call goes up as a `call` and comes back as the gateway's
reply; every report goes up as a `report`; the ending goes up as `end`. The
agent never touches data any other way.
"""

from __future__ import annotations

import json
import sys
from typing import Any


class Bridge:
    def __init__(self) -> None:
        self._id = 0

    def _send(self, obj: dict[str, Any]) -> None:
        sys.stdout.write(json.dumps(obj) + "\n")
        sys.stdout.flush()

    def _next_id(self) -> int:
        self._id += 1
        return self._id

    def _await_reply(self, want: int) -> dict[str, Any]:
        while True:
            line = sys.stdin.readline()
            if line == "":
                raise EOFError("the bridge closed before a reply arrived")
            line = line.strip()
            if line == "":
                continue
            msg = json.loads(line)
            if msg.get("type") == "reply" and msg.get("id") == want:
                return msg

    def read_start(self) -> dict[str, Any]:
        """Block for the one `start` message that opens a run."""
        while True:
            line = sys.stdin.readline()
            if line == "":
                raise EOFError("no start message arrived")
            line = line.strip()
            if line != "":
                return json.loads(line)

    def call(self, tool: str, args: dict[str, Any]) -> dict[str, Any]:
        """Call a gateway tool. Returns the ToolReply: {ok, reply} or {ok, refused}."""
        rid = self._next_id()
        self._send({"type": "call", "id": rid, "tool": tool, "args": args or {}})
        return self._await_reply(rid)

    def report(self, event: dict[str, Any]) -> None:
        """Write one run event to the event log, before the next step starts."""
        rid = self._next_id()
        self._send({"type": "report", "id": rid, "event": event})
        self._await_reply(rid)

    def end(self, ending: dict[str, Any]) -> None:
        """Hand the ending out — one of the four the contract allows."""
        self._send({"type": "end", "ending": ending})
