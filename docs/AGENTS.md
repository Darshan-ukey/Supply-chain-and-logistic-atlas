# Atlas Intelligence v0.6.3 agent runtime

## Supervisor and governance gates
- Orchestrator — routes intent and invokes the minimum specialist set.
- Input Quality / Trust Gate — runs before chat/document intelligence.
- Audit — validates response/UI actions and frozen-model integrity after reasoning.
- Human Review Inbox — captures contradictions, quarantined evidence, proposed corrections and unresolved items.

## Knowledge and navigation agents
Atlas Knowledge; Navigator; Evidence; Compare; Flow Simulator; Source Conflict; Impact; Exception; Lineage; Actor Responsibility; System Interaction; Regulatory Overlay; Enterprise Dependency; Control & Risk; Coverage.

## Client and transformation agents
Document Intake; Client Research; Client Evidence & Validation; Client Mapping; Discovery; Deviation; Gap & Whitespace; Opportunity Discovery; Solution Pattern; Future-State Designer; Scenario Validation.

## Runtime rule
The LLM is a synthesis engine only. It receives an evidence packet produced from the frozen Atlas and reviewed client-workspace evidence. It is never the source of Atlas truth.

## Writes
No agent can mutate the frozen Atlas. Workspace/evidence persistence is separate and server-side. Client claims require human approval before commit/promotion.

## Full Atlas integration
Generic Page 0/current-Atlas questions use a read-only full-Atlas evidence index. Road LTL questions preferentially use the structured V1.2 process graph. No agent gains Atlas write permission.


## v0.6.5 Atlas Explainer / Constitution
The `explainer` specialist resolves exact Atlas entity/namespace/provenance before the LLM is asked to explain it. It reads `data/atlas-constitution-v6.2.3.json`, which is also the source for the V6.2.3 How-to-Read guide. If two valid namespaces remain, it asks the user to clarify and does not invoke the LLM.

The LLM is an explanation layer only: practical plain-English meaning first, followed by classification, provenance, source boundaries and applicability/confidence.
