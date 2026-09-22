# ATL-80 — Governed Seed Knowledge-Type Registry Contract Pack V0.1

**Task:** ATL-80 / logical ATL-79A  
**Status:** IMPLEMENTED_UNVERIFIED  
**Date:** 2026-09-22  
**Purpose:** Provide the minimum governed, version-pinned entity-type and relationship-type contracts required to rerun ATL-79 criterion #3 without invented type versions.

## 1. Governing boundary

This pack is intentionally minimal. It covers only the semantic types and relationship semantics required by ATL-79 facts F1–F4 and their stated Z1→Z5 mappings. It is not a complete Atlas ontology.

Every persisted knowledge record consuming this pack must pin the exact `(type_id, type_version)`. A semantic change to a type contract requires a successor `type_version`; prior records remain interpreted against their original pinned version.

Candidate lifecycle used here:
`CANDIDATE → VALIDATED → APPROVED → ACTIVE → DEPRECATED`.

This BUILD creates logical contract records only. It does not create physical tables, apply DDL, mutate Supabase, promote the contracts to ACTIVE, or close ATL-79.

## 2. Machine-validation convention

Each `schema_contract` below is JSON-Schema-compatible logical JSON. Required extension attributes must be validated against the exact pinned type version at governed write time.

Common kernel fields such as `knowledge_id`, `knowledge_version`, `ownership_zone`, `canonical_name`, `definition`, `support_state`, provenance/evidence linkage and governing-contract identity remain governed by the ATL-60 stable kernel and are not duplicated inside every extension schema.

## 3. Seed entity-type contracts

### ET-BUSINESS-OBJECT @ 1.0.0

- type_id: `ET-BUSINESS-OBJECT`
- type_version: `1.0.0`
- name: `BUSINESS_OBJECT`
- description: A reusable operational object with governed identity and semantics that may participate in operational relationships.
- default_ownership_zone: `Z1`
- status: `CANDIDATE`
- governing_contract_id: `ATL-80-SEED-KNOWLEDGE-TYPE-REGISTRY`
- schema_contract:
```json
{
  "type": "object",
  "properties": {
    "object_kind": {"type": "string"},
    "identity_components": {"type": "array", "items": {"type": "string"}},
    "distinction_rules": {"type": "array", "items": {"type": "string"}}
  },
  "additionalProperties": false
}
```
ATL-79 consumer: F1 `KN-LTL03-REFERENCE-OBJECT@1`. The Typed Reference/PRO distinction remains instance semantics; this type is not LTL-specific.

### ET-RULE @ 1.0.0

- type_id: `ET-RULE`
- type_version: `1.0.0`
- name: `RULE`
- description: A reusable governed operational rule whose applicability may be conditional and jurisdiction/context constrained.
- default_ownership_zone: `Z1`
- status: `CANDIDATE`
- governing_contract_id: `ATL-80-SEED-KNOWLEDGE-TYPE-REGISTRY`
- schema_contract:
```json
{
  "type": "object",
  "properties": {
    "rule_statement": {"type": "string"},
    "required_when": {"type": ["object", "array", "string"]},
    "prohibited_when": {"type": ["object", "array", "string"]},
    "jurisdiction_scope": {"type": ["object", "array", "string"]},
    "regulatory_reference": {"type": ["array", "string"], "items": {"type": "string"}}
  },
  "required": ["rule_statement"],
  "additionalProperties": false
}
```
ATL-79 consumer: F2 `KN-LTL03-DG-TECHNICAL-NAME-CONDITIONAL@1`. U.S./49 CFR conditionality is instance applicability, not universal type meaning.

### ET-EXCEPTION @ 1.0.0

- type_id: `ET-EXCEPTION`
- type_version: `1.0.0`
- name: `EXCEPTION`
- description: A governed operational exception condition and required exception-handling consequence.
- default_ownership_zone: `Z1`
- status: `CANDIDATE`
- governing_contract_id: `ATL-80-SEED-KNOWLEDGE-TYPE-REGISTRY`
- schema_contract:
```json
{
  "type": "object",
  "properties": {
    "trigger_condition": {"type": ["object", "array", "string"]},
    "handling_action": {"type": "string"},
    "blocks_straight_through_processing": {"type": "boolean"},
    "binding_requirements": {"type": "array", "items": {"type": "string"}}
  },
  "required": ["trigger_condition", "handling_action"],
  "additionalProperties": false
}
```
ATL-79 consumer: F3 `KN-LTL03-HITL-CRITICAL-VALIDATION@1`. Client/runtime confidence threshold remains Z2 binding rather than being embedded in this type.

### ET-DEPENDENCY @ 1.0.0

- type_id: `ET-DEPENDENCY`
- type_version: `1.0.0`
- name: `DEPENDENCY`
- description: A governed reusable statement that execution or semantic resolution depends on another explicitly classified source, binding, master, knowledge or decision input.
- default_ownership_zone: `Z1`
- status: `CANDIDATE`
- governing_contract_id: `ATL-80-SEED-KNOWLEDGE-TYPE-REGISTRY`
- schema_contract:
```json
{
  "type": "object",
  "properties": {
    "dependency_class": {
      "type": "string",
      "enum": ["CLIENT_BINDING", "MASTER_DATA", "SOURCE_CONTEXT", "KNOWLEDGE_GAP", "HUMAN_DECISION", "EXTERNAL_INPUT"]
    },
    "required_ref": {"type": "string"},
    "resolution_condition": {"type": ["object", "array", "string"]}
  },
  "required": ["dependency_class", "required_ref"],
  "additionalProperties": false
}
```
ATL-79 consumer: F4 `KN-LTL03-INSTRUCTION-TYPE-BINDING@1`. The active Instruction Type value set remains outside reusable Z1 truth.

## 4. Seed relationship-type contracts

ATL-79 F1 explicitly requires a governed relationship. F2–F4 can be represented as typed entities plus Z5/binding references in the dry-run; no additional relationship type is invented unless a material semantic edge is actually required.

### RT-ASSOCIATED-WITH @ 1.0.0

- type_id: `RT-ASSOCIATED-WITH`
- type_version: `1.0.0`
- name: `ASSOCIATED_WITH`
- description: Relates one governed operational knowledge object to another governed knowledge object where the source semantics establish an association but do not justify a stronger universal relationship.
- status: `CANDIDATE`
- governing_contract_id: `ATL-80-SEED-KNOWLEDGE-TYPE-REGISTRY`
- from_type_constraints:
```json
{"allowed":[{"type_id":"ET-BUSINESS-OBJECT","type_version":"1.0.0"}]}
```
- to_type_constraints:
```json
{"allowed":[{"type_id":"ET-BUSINESS-OBJECT","type_version":"1.0.0"}]}
```
- schema_contract:
```json
{
  "type": "object",
  "properties": {
    "association_role": {"type": "string"}
  },
  "required": ["association_role"],
  "additionalProperties": false
}
```
ATL-79 consumer: F1 relationship `REFERENCE_ASSOCIATED_TO_OBJECT`. The instance relationship uses `association_role` to preserve the evidence-backed role rather than creating an LTL-specific universal relationship type.

## 5. ATL-79 exact pinning map

| ATL-79 fact | Knowledge record | Pinned entity type | Required relationship pin |
|---|---|---|---|
| F1 Typed Reference | `KN-LTL03-REFERENCE-OBJECT@1` | `ET-BUSINESS-OBJECT@1.0.0` | `RT-ASSOCIATED-WITH@1.0.0` for `REFERENCE_ASSOCIATED_TO_OBJECT` |
| F2 DG Technical Name conditional | `KN-LTL03-DG-TECHNICAL-NAME-CONDITIONAL@1` | `ET-RULE@1.0.0` | none required by current dry-run representation |
| F3 HITL route | `KN-LTL03-HITL-CRITICAL-VALIDATION@1` | `ET-EXCEPTION@1.0.0` | none required by current dry-run representation |
| F4 Instruction Type binding | `KN-LTL03-INSTRUCTION-TYPE-BINDING@1` | `ET-DEPENDENCY@1.0.0` | none required by current dry-run representation |

## 6. Successor-version / historical interpretation contract

The registry identity is the composite `(type_id, type_version)`.

Example:
- `ET-RULE@1.0.0` defines the validation contract used by F2.
- If a future governed change alters the semantic definition, required attributes or validation behavior, it creates a successor such as `ET-RULE@1.1.0` or `ET-RULE@2.0.0` according to the governed compatibility policy established at physical design.
- Existing F2 remains pinned to `ET-RULE@1.0.0`; it does not inherit the successor contract.
- Promotion/deprecation of a type version does not rewrite historical knowledge rows.
- Revalidation against a successor version requires creation/promotion of a successor knowledge version, not silent reinterpretation.

The same rule applies to relationship contracts.

## 7. Candidate status and promotion boundary

These records are `CANDIDATE` because ATL-80 requires independent QA before ATL-79 may consume them as governed type-version authority.

Logical lifecycle:
1. CANDIDATE — built but not independently accepted.
2. VALIDATED — first-party verification passed.
3. APPROVED — required independent QA/Owner gate passed.
4. ACTIVE — authorized for governed generation/materialization.
5. DEPRECATED — retained for historical interpretation but unavailable for new records unless an explicit governing rule permits it.

ATL-80 BUILD does not self-promote CANDIDATE contracts.

## 8. BUILD self-check targets for VERIFY

VERIFY must test, against the persisted artifact:
1. all four ATL-79 entity usages have stable IDs and explicit versions;
2. each type's semantic payload contract is machine-validatable;
3. F1 relationship has stable ID/version and explicit endpoint constraints;
4. successor-version semantics prevent silent reinterpretation;
5. generic type definitions do not universalize LTL/BOL-specific facts;
6. the pinning map is sufficient to rerun ATL-79 criterion #3 without invented versions;
7. no DDL/Supabase mutation was required;
8. no extra ontology types were added without ATL-79 justification.

Independent QA remains required after first-party VERIFY/PROVE and before ATL-79 consumes this pack.
