# malkom_langgraph

The Python side of the engine's **LangGraph adapter** — the second of the two
adapters the engine ships on day one.

The agent is a real LangGraph `StateGraph` (a `think` node and an `act` node,
looping until the agent ends). The TypeScript `langgraphAdapter` starts this
process and relays, over one newline-delimited-JSON channel on stdin/stdout:

- every **tool call** → the real MCP gateway (pass checked, call recorded and timed);
- every **report** → the real event log (written before the next step);
- the **ending** → one of the four the contract allows (done / question / handover / parked).

The graph decides its own steps; the adapter never controls them. The contract
around it is the engine's, identical to the TypeScript adapter's.

## The model

- **No key configured** → the deterministic **sandbox clerk** (`clerk.py`)
  stands in, so a draft runs end to end with no provider. It is a direct port
  of the engine's TypeScript sandbox clerk, so both adapters read a case the
  same way and reach the same ending.
- **A provider configured** → a real LangChain chat model. The host names the
  provider on the run and sets `MALKOM_LG_MODEL` plus the provider's key
  (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY`) in the environment; the engine's
  model handle stays opaque, so the definition centre never learns the model.

## Install

```
pip install -r requirements.txt          # langgraph + langchain-core (the clerk)
# for a real provider, also one of:
pip install langchain-anthropic           # or langchain-openai
```

The TypeScript adapter runs `python -m malkom_langgraph` with this directory on
`PYTHONPATH`. Point it at a specific interpreter with `MALKOM_PYTHON`.
