# ATL-161 — Atlas v1.5 Explicit Knowledge & Gap States

Status: v1.5 bounded epistemic-state contract. Successor lifecycle: ATL-162/v2.

## Purpose
Atlas must visibly distinguish established knowledge from unresolved knowledge. Absence of evidence never becomes confidence. The same bounded vocabulary applies to Daughter/depth output, Inspector/Ask, WorkDefinition, readiness, and Malkom projection.

## Canonical taxonomy
- KNOWN_AUTHORITATIVE — directly supported by applicable governed authoritative/canonical evidence; retain provenance and applicability.
- VALIDATED — bounded candidate passed the explicit v1.5 validation gate for its declared scope; retain candidate lineage and validation evidence.
- CANDIDATE — proposed knowledge/evidence not yet validated; visibly non-canonical with provenance.
- INFERRED — derived through explicit synthesis/inference; retain evidence and inference boundary.
- CONFLICTING — relevant evidence cannot be reconciled; expose conflict and never choose silently.
- UNKNOWN — required knowledge cannot currently be established; never fabricate a value.
- RESEARCH_REQUIRED — resolution requires bounded evidence research; carry the research question/scope.
- CLIENT_BINDING_REQUIRED — resolution depends on client policy, SOP, configuration, contract or decision.
- MASTER_OR_EXTERNAL_DATA_REQUIRED — resolution requires master/reference/transactional or external data not present in governed Atlas knowledge.
- NOT_APPLICABLE — explicitly out of scope after applicability evaluation; retain rationale/evidence.
- UNSUPPORTED — requested claim/action is outside supported governed capability/evidence; fail closed.

These are epistemic/disposition states, not workflow-completion states.

## Fail-closed resolution
CONFLICTING blocks a positive claim until resolved. UNSUPPORTED means capability/evidence boundary, not merely missing data. Prefer CLIENT_BINDING_REQUIRED or MASTER_OR_EXTERNAL_DATA_REQUIRED over UNKNOWN when the missing dependency is known. RESEARCH_REQUIRED does not authorize unbounded research. INFERRED never becomes KNOWN_AUTHORITATIVE merely because it is plausible. NOT_APPLICABLE requires an applicability decision. CANDIDATE remains non-canonical until the controlled validation transition succeeds.

## Required surfaces
Every material item must carry or deterministically resolve to one canonical state.

Daughter/depth: expose knowledge_state, material source/provenance IDs, scope/boundary and unresolved dependency. Generated prose must not hide inferred, candidate, conflicting or gap posture.

Inspector/Ask: return state with the answer/claim; for non-positive states expose why it applies and the next governed resolution path when one exists.

Bounded WorkDefinition: retain state for material requirements, inputs, rules and dependencies. Unresolved/conflicting states cannot become executable truth.

Readiness summary: aggregate unresolved states without laundering them into one readiness percentage; report state counts/identities and bounded blockers.

Malkom projection: each projected field/rule/value carries a state or explicit mapping. KNOWN_AUTHORITATIVE/VALIDATED may be consumable subject to the Malkom contract; INFERRED/CANDIDATE require visible qualification; unresolved gap/conflict states fail closed unless the consumer contract defines a safe non-value disposition.

## Sole v1.5 promotion
Only CANDIDATE -> VALIDATED is implemented. It requires candidate ID/original provenance, declared validation scope, validation evidence, explicit result, validator/review identity or governed validation action, timestamp/version identity, and linkage back to the candidate.

VALIDATED does not mean canonical successor promotion, universal applicability, or KNOWN_AUTHORITATIVE. All other promotions/demotions, repeated-observation learning, cross-engagement reuse and canonical successor generation are deferred.

## Minimal interoperable record
Required for material records: knowledge_state, object_or_claim_id, scope, reason. Also retain source_or_provenance_ids; unresolved_dependency when relevant; candidate_lineage_id and validation_evidence_ids for validation; updated_at/version identity.

## Relationship to ATL-153
ATL-153 governs frozen Source/Universe identity, provenance, bounded research and candidate evidence. ATL-161 consumes that evidence posture and exposes explicit knowledge/gap state. It does not mutate the frozen Source Registry/Universe or weaken ATL-153 boundaries.

## STOP boundary
Do not build cross-engagement learning, repeated-observation promotion, automatic promotion beyond CANDIDATE -> VALIDATED, automatic canonical successor generation, generalized compounding/reuse, or autonomous conflict reconciliation. Those remain ATL-162/v2.

## Handover
Freeze: the 11-state taxonomy; fail-closed/precedence rules; surface projection contract; every executed CANDIDATE -> VALIDATED transition with lineage/evidence; unresolved states/dependencies; and lifecycle transitions deferred to ATL-162/v2.

## Acceptance mapping
All 11 required states: taxonomy. Daughter/depth, Inspector/Ask, WorkDefinition, readiness and Malkom: Required surfaces. Controlled candidate-to-validated: Sole v1.5 promotion. STOP boundary: STOP boundary. Frozen taxonomy/transitions/missing lifecycle: Handover.
