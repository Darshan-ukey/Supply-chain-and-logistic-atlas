"""malkom_langgraph — the Python side of the engine's LangGraph adapter.

A LangGraph agent, driven through the engine's runner and gateway by the
TypeScript `langgraphAdapter`. The graph decides its own steps; the contract
around it — the gateway, the pass, the event log, the four endings — is the
engine's, identical to every other adapter's.
"""

from .agent import build_agent, initial_state, run_manifest_agent
from .bridge import Bridge
from .context import Context

__all__ = ["build_agent", "initial_state", "run_manifest_agent", "Bridge", "Context"]
