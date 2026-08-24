# Ask Atlas architecture

1. Receive question + current canvas state.
2. Retrieve from the published Atlas module at the available depth.
3. If no evidence: refuse to backfill unpublished detail.
4. Optional LLM explains only the retrieved evidence.
5. Any visual command is treated as a proposal.
6. `command-validate` checks the allowlist and governed IDs before execution.

Provider output must never choose recovery routes, invent applicability, create new canonical IDs or mutate the Atlas.
