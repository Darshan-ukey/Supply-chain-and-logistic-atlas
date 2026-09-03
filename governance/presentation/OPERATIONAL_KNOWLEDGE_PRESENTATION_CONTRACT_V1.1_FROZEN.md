# Operational Knowledge Presentation Contract V1.1

**Status:** FROZEN  
**Phase:** P1R — Frozen Stack Lock v2.2 reconciliation  
**Governing architecture:** `ATLAS-DAUGHTER-EXECUTION-DEPTH-PRESENTATION-ARCHITECTURE-V1`  
**Supersedes for future implementation:** `OPERATIONAL_KNOWLEDGE_PRESENTATION_CONTRACT_V1_FROZEN.md`  
**Canonical semantic inputs:** Operational Knowledge Contract v2 + Information Resolution Contract v1

## Purpose

Define the authorization-aware, human-readable projection of Daughter Operational Knowledge after Frozen Stack Lock v2.2. This contract changes presentation/projection semantics only. It does not change Daughter task identity, Operational Knowledge canonical truth, Work Decomposition, WorkDefinition, Client Binding or runtime semantics.

The frozen presentation sequence remains:

**Overview → Operational Knowledge → Execution Readiness → [Protected] Work Decomposition → [Protected] WorkDefinition**

Information Resolution is **not a sixth layer**. It is a first-class component rendered inside Operational Knowledge.

## Canonical source families

The safe projection is compiled from governed A5/Operational Knowledge content including:
- task identity, meaning, preconditions, postconditions and business outcome;
- applicability and prohibited/required conditions;
- input/output object references and canonical system-of-record roles;
- required information and reusable canonical information/object contracts;
- Information Resolution contracts;
- decision gates, constraints, controls and canonical actions;
- state/branch/exception/recovery semantics;
- timing/clock semantics;
- responsibility and authority roles;
- systems/exchanges and documents/objects;
- evidence and expected outcomes;
- client-binding requirements and resolution status;
- provenance/evidence class;
- executability and WorkDefinition-readiness metadata.

## Required presentation sections

### 1. What information is required?
May show:
- canonical field/concept label;
- canonical object family/scope;
- datatype/cardinality/unit class where safe;
- `requiredWhen` and `prohibitedWhen` in human-readable form;
- why the information is needed;
- value-origin class;
- safe validation summary;
- evidence class;
- canonical resolution/binding status.

### 2. How is the information resolved?
This section is the P1R addition derived from Information Resolution v1.

May show safe human-readable summaries of:
- business meaning and canonical scope;
- permitted value-origin/evidence-source classes;
- association requirement — what canonical object instance the value must belong to;
- normalization requirement — canonical domain/unit/code treatment;
- field validation and cross-field/cross-object validation **at summary level**;
- authority role and system-of-record role;
- conflicting-source policy;
- missing-value policy;
- confidence/HITL policy;
- jurisdiction/condition applicability;
- source-context/client-binding/metric-definition status.

The projection must not expose enough detail to reconstruct protected machine-ready resolution logic.

### 3. What decisions and rules govern the work?
May show:
- decision/gate label or question;
- human-readable condition;
- pass/fail/hold outcome family;
- evidence/basis class;
- whether client configuration is required.

Machine predicates, ASTs, compiler expressions and exact runtime routes are protected.

### 4. What controls and actions occur?
May show:
- control objective;
- execution point;
- failure behavior;
- action description;
- precondition/postcondition;
- canonical performer/authority/system role;
- safe evidence class.

### 5. What can happen next?
May show:
- state-family summary;
- branch type;
- human-readable branch condition;
- next-handling/downstream-handoff summary;
- exception/recovery family;
- required-evidence summary.

Exact compiled transition graphs remain protected.

### 6. What timing applies?
May show:
- clock type;
- activation/stop semantics;
- deadline-resolution class;
- timezone/context class;
- canonical resolution status.

Actual client/carrier cut-offs, contract time bars and compiled timer expressions remain scoped/protected.

### 7. Who and what systems are involved?
May show:
- performer/owner/decision-authority/exception-owner canonical roles;
- producer/authority/consumer system roles;
- interface class;
- canonical object/document family.

Exact client application/environment/endpoint/field mappings remain own-workspace data.

### 8. What proves completion?
May show:
- evidence type/requirement;
- acceptance criteria summary;
- evidence class;
- outcome/state-family summary;
- retention class where safe.

### 9. What remains unresolved or client-dependent?
May show:
- canonical resolution status;
- binding category/type;
- canonical binding concept;
- source-context pending status;
- metric-definition pending status;
- safe collection question only for entitled Pilot/Client Workspace/Admin/Owner users;
- aggregate unresolved counts.

## Information Resolution projection allowlist

Public/normal safe projection MAY emit only deliberately constructed presentation fields. Recommended classification:

| Canonical Information Resolution content | Safe projection treatment |
|---|---|
| `canonicalFieldId`, `canonicalObjectRef` | trace identifier; optional display |
| `businessMeaning` | SAFE_ALL |
| `scope` | SAFE_ALL |
| `shape.datatype`, `shape.cardinality`, `shape.unit` | SAFE_ALL / SAFE_SUMMARY |
| `shape.codeAuthority` | SAFE_SUMMARY; no restricted source leakage |
| `applicability.requiredWhen`, `prohibitedWhen`, jurisdiction/condition status | SAFE_SUMMARY |
| `valueOrigin.originClass` | SAFE_ALL |
| `valueOrigin.allowedEvidenceSources` | SAFE_SUMMARY by evidence/source class only; exact source IDs omitted |
| label/layout extraction hints | PRIVATE_DEFAULT unless separately approved |
| extraction/derivation/association/normalization rules | SAFE_SUMMARY only; exact machine-ready logic protected |
| field/cross-field/cross-object validation | SAFE_SUMMARY only; exact executable expressions protected |
| `authority.authorityOwner`, `systemOfRecordRole` | SAFE_SUMMARY canonical role |
| exact `authoritySource` / source claims | GOVERNANCE |
| conflict/missing/confidence/human-review policy | SAFE_SUMMARY |
| binding resolution status | SAFE_ALL |
| client binding slots/actual values | OWN_WORKSPACE |
| runtime mappings | EXECUTION_PROTECTED / OWN_WORKSPACE as applicable |
| measurement profile names | SAFE_SUMMARY where non-sensitive |
| runtime feedback observations | OWN_WORKSPACE / GOVERNANCE |

## Status normalization

Canonical statuses are preserved in backend records. Presentation labels are aliases only.

| Canonical status | Presentation meaning |
|---|---|
| `CANONICAL_RESOLVED` / `SOURCE_RESOLVED` | Resolved reference knowledge |
| `SOURCE_CONTEXT_PENDING` | Source/context resolution required |
| `CLIENT_BINDING_REQUIRED` | Canonical need is known; client localization required |
| `RESOLVED_CLIENT_SPECIFIC` | Resolved within authorized client scope |
| `METRIC_DEFINITION_REQUIRED` | Measurement definition unresolved |
| `UNKNOWN` | Unknown / unresolved; do not infer |

Legacy P1 labels such as `RESOLVED_REFERENCE`, `CONTEXT_REQUIRED` or `RESEARCH_REQUIRED` may be used only as user-facing display aliases. They must never overwrite or replace the canonical status value.

## Explicit protected fields

The following remain absent from Public/Anonymous and normal Authenticated Atlas projections unless a stronger entitlement explicitly permits them:
- raw canonical object payloads or unclassified descendants;
- exact source IDs, claim crosswalks and restricted claim-boundary detail;
- exact extraction/association/normalization/cross-field/cross-object machine logic when reconstructive;
- exact client application/environment/endpoint/field/API/code mappings;
- client named person/team/delegated authority or local threshold/policy values;
- runtime mappings and runtime feedback tied to a client/document population;
- machine expressions, compiler payloads, agent/tool instructions;
- full Work Decomposition or WorkDefinition detail.

## Client-binding rule

Canonical resolution and client localization remain separate:
- the canonical meaning, applicability, validation need and authority class may be safe operational knowledge;
- actual client field/system/code/value/policy mappings require own-workspace or governance entitlement;
- unresolved client binding must not be misreported as missing operational knowledge when the canonical requirement is already resolved.

## Provenance rule

Task-level citation does not prove every field-level rule. Public/normal views may show evidence class, confidence/status and safe authority/source-family labels. Exact source references, source-to-claim links, claim-boundary detail and source-resolution notes require governance entitlement unless separately classified public-safe.

## No pass-through rule

If Operational Knowledge v2 or Information Resolution v1 gains a new field, that field is `PRIVATE_DEFAULT` until explicitly classified in the execution-depth field-classification registry or a superseding frozen contract.

## Projection trace identity

Every emitted presentation object retains backend trace keys sufficient to resolve canonical provenance without exposing protected detail, including at minimum:
- module ID/version;
- task ID;
- canonical element type;
- canonical element ID when available;
- Operational Knowledge contract version;
- Information Resolution contract version where used;
- presentation projection contract version.

## P2 proof requirement

The first deep P2 proof is Road LTL v1.5 `LTL-03` / BOL Information Resolution. P2 must prove safe projection of canonical information meaning, applicability, association/validation summaries and resolution status without delivering exact source claims, runtime mappings, client mappings or protected execution logic. The implementation must remain generic and continue to support Ocean FCL/LCL v0.6 where equivalent Information Resolution depth is not yet populated.

## Exit condition

P2 is conformant only if Operational Knowledge is constructed server/build-side from an explicit allowlist after authorization, new OKv2/Information Resolution fields default private, and unauthorized browsers never receive protected canonical or execution payloads.
