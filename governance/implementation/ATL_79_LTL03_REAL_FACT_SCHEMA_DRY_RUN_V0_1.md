# ATL-79 — LTL-03 Real-Fact Schema Dry-Run V0.1

**Task:** ATL-79 / logical ATL-60A  
**Status:** IMPLEMENTED_UNVERIFIED  
**Date:** 2026-09-22  
**Purpose:** Exercise the ATL-60 candidate Z1/Z5/readiness logical model with actual governed LTL-03 facts before physical DDL design.

## 1. Predetermined verification matrix — frozen before disposition

For each selected fact, PASS requires:
1. no loss or invention of material domain semantics;
2. source/provenance/authority retained;
3. exact knowledge ID/version and type/type-version identity represented;
4. applicability/condition/exception semantics retained where applicable;
5. reusable Z1 domain truth remains distinct from Z2/client binding;
6. Z1→Z5 lineage is explicit;
7. exact consumed knowledge versions are identifiable from the generated Z5 reference;
8. no undocumented free-form field carries a material governed semantic.

A material failure blocks ATL-60 physical DDL design until corrected and re-verified.

## 2. Governed evidence identities

### E1 — BOL Information Resolution Baseline v0.1
- Drive ID: `1oxEYH8mHZEZ4Y2D7mgLj2wlSl1d7bcmlBhT3lWV7J7Q`
- Status in source: `FROZEN_REFERENCE_BASELINE`
- Frozen stack SHA-256 for this baseline: `8d1593ca7133c6c0ebe72099e01e18feccd5bb906851a6affa1a36ccbddb8400`
- Authority hierarchy stated by source: competent regulation where applicable → DSDC/NMFTA → UN/CEFACT → client/carrier/runtime schema for environment-specific bindings.

### E2 — Road LTL v1.5 Operational Knowledge
- Drive ID: `16hSl8TMH_8rsKNd6XHINTLGUcJhA-QwKsdc2639vIw0`
- Status in source: `FROZEN_OPERATIONAL_REFERENCE`
- Canonical GitHub path declared by source: `data/operational-knowledge/road-ltl-v1.5-operational.json`
- SHA-256 declared by source: `6bf09b05fef2967bda48800cf5ba926487f3df6ca467f0316ca52334045a22a9`

### E3 — P6.1 V1 LTL-03 Reconstructed Protected Decomposition
- GitHub branch: `atlas-p6-1-v1-reconstruction`
- Path: `governance/baselines/P6_1_V1_LTL03_RECONSTRUCTED_DECOMPOSITION.json`
- Blob SHA observed during ATL-79 pickup: `b2e468723611230ff53e0615ec9a347b848692e3`
- decompositionId: `road-ltl-1.5__LTL-03__P6.1-V1__RECONSTRUCTED-2026-09-14`
- Current observed summary: 64 work units; 48 leaves; 0 EXECUTOR_READY; 45 BLOCKED_BY_CLIENT_BINDING; 3 BLOCKED_BY_KNOWLEDGE_GAP.

## 3. Selected real facts

### F1 — Typed Reference object; PRO remains distinct
**Source fact (E1):** Reference Number resolves as a typed Reference object with value, type, issuer/role and related object. PRO remains distinct where the governing LTL standard defines it.

**Candidate Z1 entity**
- knowledge_id: `KN-LTL03-REFERENCE-OBJECT`
- knowledge_version: `1`
- ownership_zone: `Z1`
- entity_type: `BUSINESS_OBJECT`
- entity_type_version: **UNRESOLVED — no governed seed type-registry version exists yet**
- canonical_name: `Typed Reference`
- definition: reference identity carrying value, type/type-scheme, issuer/role and related-object association.
- support_state: `SUPPORTED`
- evidence: E1 / Source-backed findings
- source_class: `AUTHORITATIVE_RESEARCH`

**Candidate relationship semantics**
- `REFERENCE_ASSOCIATED_TO_OBJECT`
- relationship_type_version: **UNRESOLVED — no governed seed relationship-type version exists yet**
- PRO distinction retained as governed semantic, not flattened into generic reference text.

**Z5 reference**
- `WD-LTL03-06 — Resolve typed Reference objects`
- E3 decomposition identity above.

### F2 — Dangerous-goods Technical Name is conditionally applicable
**Source fact (E1):** Technical Name and inhalation-hazard Zone are conditional in specified regulatory cases; requiredWhen/prohibitedWhen must be explicit.

**Candidate Z1 entity**
- knowledge_id: `KN-LTL03-DG-TECHNICAL-NAME-CONDITIONAL`
- knowledge_version: `1`
- ownership_zone: `Z1`
- entity_type: `RULE`
- entity_type_version: **UNRESOLVED — no governed seed type-registry version exists yet**
- canonical_name: `Dangerous Goods Technical Name Conditional Applicability`
- applicability: jurisdiction/regulatory-condition gated; not universal.
- semantic_payload requirement: preserve explicit `requiredWhen` / `prohibitedWhen` logic once the exact governing rule expression is carried from the source-claim layer.
- support_state: `SUPPORTED`
- evidence: E1 / Source-backed findings
- source_class: `AUTHORITATIVE_RESEARCH`

**Z5 references**
- `WD-LTL03-09 — Resolve conditional DangerousGoods objects`
- `WD-LTL03-14 — Evaluate conditional applicability`

### F3 — Critical low-confidence/failed validation routes to governed HITL
**Source fact (E2):** Critical low-confidence or failed validation prevents straight-through processing and routes to governed HITL/exception handling.

**Candidate Z1 entity**
- knowledge_id: `KN-LTL03-HITL-CRITICAL-VALIDATION`
- knowledge_version: `1`
- ownership_zone: `Z1`
- entity_type: `EXCEPTION`
- entity_type_version: **UNRESOLVED — no governed seed type-registry version exists yet**
- canonical_name: `Critical Confidence / Failed Validation HITL Route`
- support_state: `SUPPORTED`
- evidence: E2 / Exception policy
- source_class: `AUTHORITATIVE_RESEARCH`

**Z2 boundary retained**
- E3 shows the active threshold itself is not reusable Z1 truth: `CB-LTL03-CRITICAL-CONFIDENCE-THRESHOLD`.
- Therefore Z1 carries the rule that critical-low/failed cases block STP and route to HITL; Z2 supplies the client/runtime threshold.

**Z5 references**
- `WD-LTL03-17A — Critical confidence/validation sufficient for straight-through processing?`
- `WD-LTL03-17B — Route critical low-confidence/failed-validation cases to governed HITL review`

### F4 — Instruction Type value set is client/source-context binding, not invented domain truth
**Source fact (E1):** exact Instruction Type values are explicitly unresolved and must be marked SOURCE_CONTEXT_PENDING or CLIENT_BINDING_REQUIRED until the governing schema resolves them.

**Candidate Z1 entity**
- knowledge_id: `KN-LTL03-INSTRUCTION-TYPE-BINDING`
- knowledge_version: `1`
- ownership_zone: `Z1`
- entity_type: `DEPENDENCY`
- entity_type_version: **UNRESOLVED — no governed seed type-registry version exists yet**
- canonical_name: `Instruction Type Value-Set Binding Requirement`
- definition: reusable knowledge that an Instruction Type concept exists but its exact active value set cannot be promoted as universal domain truth from current evidence.
- support_state: `CLIENT_BINDING_REQUIRED`
- evidence: E1 / Explicit unresolved semantics
- source_class: `AUTHORITATIVE_RESEARCH`

**Z2 binding**
- `CB-LTL03-INSTRUCTION-TYPE-VALUE-SET` from E3.
- No client value is copied into the Z1 record.

**Z5 references**
- `WD-LTL03-10 — Resolve instructions and service/event windows`
- `WD-LTL03-18B — Emit explicit unresolved binding/source-context register`

## 4. Candidate evidence-link representation

Each fact requires an `atlas_knowledge_evidence_links` row with:
- exact `knowledge_id` + `knowledge_version`;
- `evidence_source_kind = AUTHORITATIVE_RESEARCH`;
- `evidence_ref` = E1 or E2 Drive ID;
- locator = named source section above;
- support_role = `SUPPORTS`;
- authority_class inherited from the frozen evidence's declared authority/source hierarchy where applicable.

This dry-run does not load the evidence through `atlas_client_documents` / `atlas_document_chunks`.

## 5. Candidate Z1→Z5 generation-run representation

- generation_run_id: `ATL79-DRYRUN-GEN-001`
- decomposition_id: `road-ltl-1.5__LTL-03__P6.1-V1__RECONSTRUCTED-2026-09-14`
- decomposition_blob_sha: `b2e468723611230ff53e0615ec9a347b848692e3`
- generator_contract_id: `RESEARCH_TO_EXECUTION_READINESS_TRANSFORMER_CONTRACT`
- generator_contract_version: `0.1-candidate`
- generator_implementation_identity: `MANUAL_GOVERNED_DRYRUN_ATL79`
- run_status: `CANDIDATE`
- consumed knowledge manifest:
  - `KN-LTL03-REFERENCE-OBJECT@1`
  - `KN-LTL03-DG-TECHNICAL-NAME-CONDITIONAL@1`
  - `KN-LTL03-HITL-CRITICAL-VALIDATION@1`
  - `KN-LTL03-INSTRUCTION-TYPE-BINDING@1`
  - Z2 binding refs: `CB-LTL03-CRITICAL-CONFIDENCE-THRESHOLD`, `CB-LTL03-INSTRUCTION-TYPE-VALUE-SET`
  - evidence refs: E1, E2
  - Z5 basis: E3
- consumed_knowledge_manifest_hash: `82e41004b6956a40367d22a65b1205cf0e391a33a87c4ed8ec8edc4fb9296c59`
- output identity: this ATL-79 dry-run artifact commit (to be bound after write/VERIFY).

## 6. Initial friction register — BUILD observation, not final disposition

### FR-01 — governed seed type versions are missing from the logical design
The logical schema correctly requires every entity/relationship row to pin `(type_id, type_version)`, but the current candidate design provides only example seed type names and does not define governed initial type-registry records/versions.

Consequently, the four real facts can be mapped to candidate type names, but ATL-79 cannot truthfully populate exact `entity_type_version` / `relationship_type_version` values without inventing them.

**Potential severity:** material, because ATL-79 predetermined criterion #3 requires exact type/version identity and F1 was specifically introduced to prevent silent reinterpretation.

**Required decision after VERIFY:** either (a) treat a governed seed type-contract pack as a required pre-DDL schema artifact and create it as a separate Linear prerequisite under the new task-creation rule, or (b) demonstrate an already-governed type-version source that this dry-run has not yet located.

No correction is made inside this BUILD artifact before VERIFY.
