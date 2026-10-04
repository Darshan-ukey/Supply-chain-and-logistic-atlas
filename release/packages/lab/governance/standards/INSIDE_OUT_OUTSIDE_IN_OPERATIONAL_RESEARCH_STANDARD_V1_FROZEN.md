# Inside-Out / Outside-In Operational Research Standard V1 — FROZEN

Status: **FROZEN GOVERNING STANDARD**  
Effective: 2026-09-02

## Purpose
Establish the repeatable research system used to enrich every Atlas daughter module from process/reference depth into operational depth without inventing execution logic.

## Inside-out pass
Start from the governed daughter module and interrogate every A5/task for what an executor would still need to know. The gap manifest must cover, as applicable: trigger, state, required information/objects, applicability, validation, decisions, rules, controls, actions, branches, exceptions, clocks, actors/authority, systems/exchanges, documents/fields, evidence, outcomes, and client-binding requirements.

Each gap must be phrased as a concrete research question rather than a generic statement that more detail is needed.

## Outside-in pass
Independently research how the operation is defined by authoritative operational sources. Source priority is:
1. law/regulation/competent authority;
2. industry operating standards;
3. mode/domain specifications;
4. official APIs/data dictionaries;
5. object/event/document/message standards;
6. classification/reference-data authorities;
7. recognized operating guidance;
8. APQC/SCOR and similar frameworks for architecture/crosswalk, not as substitutes for execution semantics.

Outside-in research asks what authoritative operational knowledge says exists; it must not merely search for confirmation of the current Atlas model.

## Convergence classification
Every researched claim must be classified as one of:
- CONFIRMED
- ENRICH
- CONTEXT_SPECIFIC
- CONTRADICTS_CURRENT_ATLAS
- CLIENT_BINDING_REQUIRED
- SOURCE_ACCESS_GAP
- UNKNOWN

No contradiction is silently reconciled. No unknown is silently filled.

## Promotion rule
Only claims with explicit provenance and applicability may promote into Operational Knowledge. The operational layer must distinguish canonical semantics from client/runtime values.

## Output
Each research run produces: Inside-Out Gap Manifest, Outside-In Source Claim Graph, convergence decisions, provenance links, unresolved/source-access gaps, and regression impact.
