# ATL-155 — Atlas v1.5 Bounded Daughter Knowledge & Page Generation Contract

Status: **FROZEN**

## Decision
Atlas v1.5 generates a **canonical Daughter knowledge model first** and derives the page as a projection. The projection cannot introduce claims absent from the canonical model.

## Bounded proof
- **Road LTL:** governed ACTIVE / A5_VERIFIED proof case. Frozen registry records 22 processes, 13 A3 parents, 39 edges and 29 sources. Generator may materialize hierarchy, objects/documents, actors, systems, events, dependencies, controls and gaps from the approved module/provenance inputs.
- **Ocean FCL / Ocean LCL:** frozen baseline currently marks both PLANNED / REFERENCE_ONLY. v1.5 therefore generates only identity/reference/source/gap projections and marks unsupported depth RESEARCH_REQUIRED. It MUST NOT fabricate Ocean A4/A5 or execution topology.
- A TEST_ONLY fixture may exercise mechanics but can never become a published Daughter.

## Generator boundary
Inputs: frozen Page-0 parent; approved module/catalog/registry; governed provenance/source records; ATL-161 state semantics.
Outputs: canonical Daughter knowledge model; derived existing-UX page projection.
Baseline knowledge remains distinct from deeper/on-demand research. Provenance and version identity are mandatory.

## Supported structural patterns
1. ACTIVE + A5_VERIFIED — full bounded canonical-model/page projection from governed inputs.
2. PLANNED + REFERENCE_ONLY — fail-closed reference/gap projection only.
3. TEST_ONLY fixture — mechanism proof only; never publish.

## Unsupported in v1.5
Universal ~70-Daughter generation; unsupported A4/A5 synthesis; absent structural patterns; universal selective regeneration; automatic research/candidate promotion beyond ATL-161.

## STOP / handover
Freeze generator inputs/outputs, supported patterns, unsupported patterns and proof dispositions. Generic cross-domain generation/regeneration remains ATL-156/v2.

## Frozen implementation
- Generator: `scripts/generate-bounded-daughter-v1.js` (deterministic, no LLM-authored canonical content).
- Schemas: `data/contracts/atlas-daughter-knowledge-model-v1.schema.json` and `data/contracts/atlas-daughter-page-projection-v1.schema.json`.
- Materialized outputs: Road LTL canonical model + derived projection; Ocean FCL/LCL REFERENCE_ONLY model/projection pairs under `data/generated/daughters/`.
- Verification: `tests/atl-155-bounded-daughter-generation.test.js` covers byte-identical regeneration, 22/13/39/29 reconciliation, REFERENCE_ONLY A4/A5 refusal, and TEST_ONLY publication refusal.
- Existing UX consumption target: `index.html` → `window.activateModule("road-ltl")` → existing spatial canvas / selected-item Inspector. Reference-only daughters remain registry/reference coverage surfaces until governed depth exists.
- Ownership: generator writes; ATL-155 verification validates; promotion remains Owner-gated at ATL-142.
