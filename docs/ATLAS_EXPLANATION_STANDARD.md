# Atlas Explanation Standard — v0.6.5

For a normal “what does this mean?” question, the chatbot should answer in this order when evidence exists:

1. **In simple English** — what the thing means in real operations.
2. **Why it matters** — operational/business purpose or consequence.
3. **Where it fits** — page/phase/process/dependency context.
4. **Atlas classification** — process, source, overlay, runtime state, ontology entity, etc.
5. **Origin / provenance** — source-native, crosswalk, Atlas analytical construct, child synthesis, runtime state.
6. **Evidence / source** — bounded supporting source IDs/frameworks when available.
7. **Applicability / confidence** — conditional scope or readiness where available.
8. **Optional next action** — Trace, Show source, Compare, Explain deeper.

## Ambiguity rule
When a term has more than one valid namespace and active UI context does not resolve it, ask a clarification question. Do not rank a winner just because a keyword score is slightly higher.

## Example: OTHER_LTL_KNOWLEDGE
**In simple English:** Other parts of the LTL operating model still exist, but are not directly involved in the thing currently being traced.

**Classification:** Runtime / presentation classification.
**Namespace:** Trace relevance.
**Origin:** Current trace + governed LTL graph.
**Source-native:** No.
**Regulatory:** No.
**Changes Atlas:** No.

## Example: Road LTL process
A process explanation should explain what actually occurs operationally and why the step exists, then state that the A4 record is Atlas child synthesis when that is its provenance, with its sourceMap/claim boundary and supporting source IDs kept explicit.
