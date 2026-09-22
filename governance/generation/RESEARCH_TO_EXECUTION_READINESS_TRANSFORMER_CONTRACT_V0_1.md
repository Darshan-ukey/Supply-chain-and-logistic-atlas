# Research-to-Execution-Readiness Transformation Generator Contract V0.1

**Status:** CANDIDATE — INDEPENDENT QA AND OWNER FREEZE REQUIRED BEFORE CANONICAL MATERIALIZATION  
**Date:** 2026-09-22  
**Engine ID:** ATLAS-RESEARCH-TO-EXECUTION-TRANSFORMER  
**Applies to:** ATL-60 LTL-03 proof and successor governed uses  
**Governing standards:** Atlas Product Constitution V1; AR0.2 Layer Boundary Decision Rebased V2; Canonical Generation & Freeze-Asset Standard V1; Controlled Phase Execution & Recovery Gate V1.

## 1. Semantic purpose
Transform a frozen/reconciled evidence-backed Operational Knowledge candidate into governed structured knowledge and candidate execution semantics without inventing missing business meaning.

This is **Mechanism 2** only. It does not replace the separate In-Depth Knowledge Research Mechanism (Mechanism 1).

## 2. Owned input contracts and versions
Required inputs for a run:
1. exact frozen/reconciled research/evidence baseline identity;
2. Z0 source/provenance records and source hashes/references where available;
3. Z1 operational/domain knowledge candidate and explicit gaps/conflicts;
4. applicable frozen semantic schemas/contracts;
5. applicable frozen Work Decomposition and Canonical WorkDefinition contracts;
6. frozen readiness resolver/ruleset identity;
7. optional approved Z2 Client Binding only when the run target requires enterprise readiness;
8. target executor capability/profile only when producing a runtime projection.

Floating labels such as "latest research" are prohibited.

## 3. Output contracts / lifecycle
Candidate outputs may include:
- structured Z0 provenance/knowledge-state records;
- structured Z1 reusable Operational Knowledge;
- candidate Z5 Canonical Work Decomposition;
- candidate Z5 Canonical WorkDefinitions;
- explicit Z2 binding requirements/references;
- Z6 readiness proof/manifests;
- executor-specific derived projection.

All newly generated outputs begin as **CANDIDATE**. The engine cannot self-promote output to canonical/frozen state.

## 4. Transformation rules
1. Establish/consume the full operational universe before narrowing to an execution use case.
2. Preserve source-to-knowledge lineage.
3. Assign every material record an ownership zone Z0–Z7.
4. Separate reusable Z1 semantics from Z2 client-specific values and Z5 execution semantics.
5. Derive Work Decomposition from structured Operational Knowledge, not from UI prose.
6. Preserve the trace: work node → information/object → rule/decision → condition → evidence/authority → exception → output/state → binding/gap.
7. Do not infer a missing material semantic merely to complete a schema/UI.
8. Route material domain gaps back to Mechanism 1 as bounded research requests.
9. Client Binding may resolve declared enterprise-specific requirements but may not repair missing reusable domain semantics.
10. Executor projection may map canonical meaning but may not redefine it.
11. HTML/rendering is G5 derived projection only.

## 5. Ordering, precedence and conflict rules
Authority order is governed by the applicable source registry/claim provenance and task-specific authority rules; this contract does not invent a universal source hierarchy.
- explicit unresolved source conflict remains unresolved;
- canonical/frozen input outranks an unfrozen candidate of the same governed asset class;
- client-specific evidence cannot silently supersede reusable domain truth;
- runtime behavior is evidence, not automatic canonical truth.

## 6. Engine classification
The overall transformation may be **hybrid**:
- deterministic materialization/validation steps: G1;
- LLM-assisted synthesis/classification, if used: G4.

Any G4 step must freeze prompt/instruction version, model/tool identity, retrieval/input set, parameters, post-processing/validator version and exact candidate output. Approved canonical recovery must preserve exact approved output; future regeneration is a new candidate.

## 7. External dependencies
No dependency is authorized by name/version until implementation design is frozen. Supabase/Postgres is the current target structured-store implementation, but the semantic contract is storage-portable. HTML is a G5 renderer.

## 8. Parameters/configuration/defaults
No silent defaults may convert UNKNOWN/PARTIAL/GAP/BINDING states to supported semantics. Material parameters must be versioned and hashed in each Generation Registry run.

## 9. Provenance/lineage emitted
Every material output must carry or resolve to:
- stable knowledge/output ID and version;
- ownership zone;
- source/evidence references;
- upstream asset IDs/versions/hashes;
- generator contract + implementation identity;
- run identity;
- support/knowledge state;
- downstream derivation links where applicable.

## 10. Validation and failure states
Minimum validation:
- schema/contract validity;
- stable IDs and referential integrity;
- mandatory Z0–Z7 ownership classification;
- no Z2 value promoted as reusable Z1 truth;
- no Z5 execution semantic unsupported by governed Z1/Z4 inputs;
- no unresolved mandatory domain gap hidden by Client Binding;
- source/provenance linkage for material assertions;
- Work Decomposition/WorkDefinition lineage completeness;
- readiness vocabulary limited to DOMAIN_EXECUTION_READY, ENTERPRISE_EXECUTION_READY, RUNTIME_IMPLEMENTATION_READY;
- blocker/dependency states kept separate from readiness states.

Applicable failure states include BLOCKED_OUTPUT_QA_OPEN, BLOCKED_SOURCE_OF_TRUTH_UNFROZEN, BLOCKED_GENERATOR_CONTRACT_INCOMPLETE, BLOCKED_GENERATION_REGISTRY_INCOMPLETE, BLOCKED_FREEZE_ASSET_SET_INCOMPLETE, BLOCKED_RECOVERY_NOT_PROVEN and OWNER_DECISION_REQUIRED.

## 11. Promotion rule
Candidate output may be promoted only after:
1. exact inputs and implementation identity are frozen;
2. validator passes;
3. independent crossed QA passes or passes with closed binding corrections;
4. Generation Registry record is complete;
5. applicable F0–F7 assets and PC-1–PC-7 closure are satisfied;
6. Owner/authorized gate permits promotion.

No execution agent self-promotes its own material work.

## 12. Rollback / rebuild
Before canonical Supabase mutation, preserve the prior known-good database/schema state and migration rollback path. High-risk materialization requires recovery/rebuild proof under PC-5. G4 outputs require exact approved candidate preservation rather than an assumption of byte-identical regeneration.

## 13. Compatibility
This contract cannot change the frozen Product Constitution readiness ladder or Z0–Z7 ownership model. A semantic change requires a successor contract/version and dependency-impact analysis.

## 14. ATL-60 temporary execution boundary
Until this contract is independently QA'd and Owner-frozen:
- evidence recovery/reconciliation may continue;
- operational-universe analysis may continue;
- candidate structuring outside canonical promotion may continue;
- schema inspection may continue read-only;
- **canonical Supabase mutation/promotion is blocked**.
