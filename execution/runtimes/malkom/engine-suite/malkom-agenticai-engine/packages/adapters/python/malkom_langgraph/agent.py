"""The LangGraph agent — a real StateGraph driven through the gateway bridge.

The graph is two nodes: `think` decides the next move (the sandbox clerk, or a
real LangChain chat model when a provider is configured) and `act` carries the
move out through the bridge — every tool call to the real gateway, every note
to the real event log, and the ending out. The graph loops think → act →
think until the agent ends. This is ordinary LangGraph; nothing here scripts
the steps beyond what the model (or the stand-in clerk) decides per case.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Annotated, Any, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages

from .bridge import Bridge
from .clerk import decide


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    ended: bool
    step: int


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _brief(manifest: dict[str, Any]) -> str:
    lines = [
        f'You are "{manifest["label"]}", an autonomous agent working one case on the "{manifest["queue"]}" queue.',
        "",
        "Your goal — what a finished case looks like:",
        manifest.get("goal", ""),
        "",
        "The work counts as done only when each of these fields is filled at or above its confidence floor:",
        *[f"- {o['field']} (confidence {o['minConfidence']} or better)" for o in manifest.get("output", [])],
    ]
    return "\n".join(lines)


def _clerk_thinker(start: dict[str, Any]):
    """A think() backed by the deterministic sandbox clerk."""
    tool_names = [t["name"] for t in start.get("tools", [])]
    moves = decide(start["manifest"].get("output", []), start["case"], tool_names)
    idx = {"at": 0}

    def think(state: AgentState) -> dict[str, Any]:
        at = idx["at"]
        idx["at"] += 1
        if at >= len(moves):
            return {"messages": [AIMessage(content="done")]}
        move = moves[at]
        if "tool" in move:
            call = {"name": move["tool"], "args": move["input"], "id": f"c{at + 1}"}
            text = f"call {move['tool']}"
        else:
            call = {"name": "end", "args": move["end"], "id": f"c{at + 1}"}
            text = f"end: {move['end'].get('ending')}"
        return {
            "messages": [AIMessage(content=text, tool_calls=[call])],
            "_report": {
                "type": "model.replied",
                "at": _now(),
                "step": state["step"],
                "reply": text,
                "tokensIn": 0,
                "tokensOut": 0,
                "money": 0,
                "elapsedMs": 0,
            },
        }

    return think


def _real_thinker(start: dict[str, Any]):
    """A think() backed by a real LangChain chat model, when a provider is set.

    Kept honest: this path builds a real model from the provider named on the
    run plus the model id and key the host puts in the environment. With no key
    present the runtime falls back to the clerk (see build_agent)."""
    provider = start.get("provider")
    model_id = os.environ.get("MALKOM_LG_MODEL", "")
    tools_spec = [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": (t.get("label", "") + (" — " + t["describe"] if t.get("describe") else "")),
                "parameters": t.get("args") or {"type": "object", "properties": {}},
            },
        }
        for t in start.get("tools", [])
    ]
    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic  # noqa: WPS433

        model = ChatAnthropic(model=model_id)
    else:
        from langchain_openai import ChatOpenAI  # noqa: WPS433

        model = ChatOpenAI(model=model_id)
    bound = model.bind_tools(tools_spec)

    def think(state: AgentState) -> dict[str, Any]:
        reply = bound.invoke(state["messages"])
        return {"messages": [reply]}

    return think


def _needs_provider_key(start: dict[str, Any]) -> bool:
    provider = start.get("provider")
    if provider == "anthropic":
        return os.environ.get("ANTHROPIC_API_KEY", "") != "" and os.environ.get("MALKOM_LG_MODEL", "") != ""
    if provider == "openai":
        return os.environ.get("OPENAI_API_KEY", "") != "" and os.environ.get("MALKOM_LG_MODEL", "") != ""
    return False


def build_agent(start: dict[str, Any], bridge: Bridge):
    """Compile the LangGraph graph for one run."""
    think = _real_thinker(start) if _needs_provider_key(start) else _clerk_thinker(start)

    def think_node(state: AgentState) -> dict[str, Any]:
        out = think(state)
        report = out.pop("_report", None)
        if report is not None:
            bridge.report(report)
        return {"messages": out["messages"], "step": state["step"] + 1}

    def act_node(state: AgentState) -> dict[str, Any]:
        last = state["messages"][-1]
        tool_msgs: list[BaseMessage] = []
        ended = False
        for call in getattr(last, "tool_calls", []) or []:
            name = call["name"]
            args = call.get("args", {}) or {}
            cid = call.get("id", name)
            if name == "end":
                bridge.end(args)
                ended = True
                tool_msgs.append(ToolMessage(content=json.dumps({"accepted": True}), tool_call_id=cid))
            elif name == "note":
                bridge.report({"type": "noted", "at": _now(), "step": state["step"], "note": args.get("note", "")})
                tool_msgs.append(ToolMessage(content=json.dumps({"noted": True}), tool_call_id=cid))
            else:
                reply = bridge.call(name, args)
                payload = reply.get("reply") if reply.get("ok") else {"refused": reply.get("refused")}
                tool_msgs.append(ToolMessage(content=json.dumps(payload), tool_call_id=cid))
        return {"messages": tool_msgs, "ended": ended}

    def after_think(state: AgentState) -> str:
        last = state["messages"][-1]
        return "act" if getattr(last, "tool_calls", None) else END

    def after_act(state: AgentState) -> str:
        return END if state.get("ended") else "think"

    graph = StateGraph(AgentState)
    graph.add_node("think", think_node)
    graph.add_node("act", act_node)
    graph.add_edge(START, "think")
    graph.add_conditional_edges("think", after_think, {"act": "act", END: END})
    graph.add_conditional_edges("act", after_act, {"think": "think", END: END})
    return graph.compile()


def initial_state(start: dict[str, Any]) -> AgentState:
    return {
        "messages": [
            SystemMessage(content=_brief(start["manifest"])),
            HumanMessage(content=json.dumps({"case": start["case"]})),
        ],
        "ended": False,
        "step": 0,
    }


def run_manifest_agent(ctx) -> None:
    """The engine's autonomous LangGraph loop, driven entirely by the manifest.

    The default a studio template delegates to — the LangGraph counterpart of
    the TypeScript adapter's manifestAgent. A developer replaces the call to
    this with their own graph when they want different behaviour."""
    graph = build_agent(ctx.start, ctx._bridge)
    graph.invoke(initial_state(ctx.start), config={"recursion_limit": 50})
