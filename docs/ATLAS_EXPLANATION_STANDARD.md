# Atlas Explanation Standard — v0.6.6

Atlas Intelligence separates four responsibilities:
1. Deterministic resolver: **what is this?**
2. Governed Atlas graph/context: **how does it relate and what path is valid?**
3. Source/provenance layer: **why can the Atlas say this?**
4. LLM explanation layer: **what does this mean to a human in real operations?**

Default explanation order:
- In simple English.
- Why it matters.
- Where it fits.
- Atlas classification.
- Origin/provenance.
- Evidence/source.
- Applicability/confidence when available.

Special rules:
- `PAGE_SUMMARY` summarizes the current page; it does not explain an arbitrary retrieved term.
- `SECTION_SUMMARY` uses current section/click context.
- Simulation questions use current step/handoff state supplied by the deterministic engine.
- Ambiguous terms require clarification.
- Source-native, Atlas crosswalk, Atlas child synthesis and runtime/presentation state remain distinct.
- Illustrative real-world examples must be labeled as illustrative and never become Atlas/client fact.
- `REFERENCE_ONLY`, `INFERRED`, `OBSERVED` and `PUBLICLY_EVIDENCED` never become client `CONFIRMED` automatically.
- Unmodeled API/EDI fields remain `NOT_MODELED`.
- Risk probability/severity/economics are never invented.
