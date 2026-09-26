# Atlas Business Logic, Rule Ontology & Runtime Consumption Contract V0.1 — CANDIDATE

**Status:** OWNER-ALIGNED CANDIDATE — RECONCILIATION / QA / FREEZE REQUIRED  
**Product:** Atlas v2  
**Parent product contract:** governance/product/ATLAS_V2_PRODUCT_END_STATE_CONTRACT_V1_CANDIDATE.md  
**Linear task:** ATL-119  

## 1. Purpose

Define how Atlas captures, classifies, versions, stores, retrieves, projects and governs business logic/rules so downstream execution tools can consume the same canonical semantics without rediscovering or duplicating business knowledge.

This contract deliberately separates:
1. **what kind of business rule it is**;
2. **how the rule is evaluated**;
3. **how the rule is distributed/consumed at runtime**.

The rule taxonomy in this candidate is a governed starting vocabulary, **not a closed or exhaustive universal ontology**. New domains/processes/Operational Knowledge may reveal additional rule families or subtypes. Atlas must support controlled taxonomy extension without forcing new semantics into the wrong existing category.

## 2. Canonical principle

Canonical Atlas business logic lives in governed structured knowledge / execution semantics.

Prompts, workflow scripts, spreadsheets, Malkom configuration, RPA logic and BPM gateways are **runtime projections/consumers**, not canonical business truth.

A downstream executor should be able to determine:
- which rule applies;
- why it applies;
- what inputs it needs;
- how it is evaluated;
- what happens on pass/fail/ambiguity;
- whether client binding is needed;
- what source/authority/version governs it;
- whether the rule is embedded, snapshotted or dynamically retrieved.

## 3. Rule identity and minimum envelope

A material rule should carry, where applicable:
- rule_id;
- rule_family / rule_type;
- subtype(s);
- canonical name and purpose;
- scope: domain / process / task / object / field / event / state / client / jurisdiction;
- applicability conditions;
- required inputs;
- business logic / expression / decision table / lookup semantics;
- expected result / target state;
- pass/fail/exception outcome;
- severity / criticality;
- source and authority;
- provenance / evidence references;
- version / effective_from / effective_to;
- supersedes / superseded_by;
- epistemic / knowledge state;
- client_binding_required;
- related rules / dependencies;
- evaluation_mode;
- distribution_mode;
- runtime requirements;
- evidence/audit requirements;
- failure / escalation / recovery behavior;
- Z0–Z7 ownership and governing contract where material.

## 4. Extensible rule-family taxonomy

The following families are the **current seed taxonomy**. They are not the only permitted categories.

### Applicability and qualification
- APPLICABILITY_RULE
- ELIGIBILITY_RULE
- PREREQUISITE_RULE
- NOT_APPLICABLE_RULE

### Information/data requirements
- MANDATORY_DATA_RULE
- CONDITIONAL_MANDATORY_RULE
- FORMAT_RULE
- DATA_TYPE_OR_DOMAIN_RULE
- ALLOWED_VALUE_RULE
- REFERENCE_MASTER_DATA_RULE

### Classification, derivation and calculation
- CLASSIFICATION_RULE
- DERIVATION_RULE
- CALCULATION_RULE
- TRANSFORMATION_RULE
- NORMALIZATION_RULE

### Cross-field/object semantics
- RELATIONSHIP_RULE
- CARDINALITY_RULE
- CONSISTENCY_RULE
- DUPLICATE_DETECTION_RULE
- RECONCILIATION_RULE

### Authority, precedence and conflict
- SOURCE_AUTHORITY_RULE
- SOURCE_PRECEDENCE_RULE
- CONFLICT_RESOLUTION_RULE
- OVERRIDE_RULE

### Decisions and flow
- DECISION_RULE
- ROUTING_RULE
- SEQUENCING_RULE
- STATE_TRANSITION_RULE
- COMPLETION_RULE

### Time
- TIMING_RULE
- SLA_RULE
- CUT_OFF_RULE
- EFFECTIVE_DATE_RULE
- TEMPORAL_PRECEDENCE_RULE

### Jurisdiction/policy/compliance
- JURISDICTION_RULE
- POLICY_RULE
- COMPLIANCE_RULE
- REGULATORY_RULE
- CONTRACTUAL_RULE

### Roles, authorization and controls
- ROLE_AUTHORITY_RULE
- APPROVAL_RULE
- SEGREGATION_OF_DUTY_RULE
- CONTROL_RULE
- AUTOMATION_PERMISSION_RULE
- SECURITY_ACCESS_RULE
- PRIVACY_RULE
- RETENTION_RULE

### Evidence and audit
- EVIDENCE_RULE
- AUDIT_RULE
- TRACEABILITY_RULE

### Exceptions and resilience
- EXCEPTION_DETECTION_RULE
- EXCEPTION_HANDLING_RULE
- RETRY_RULE
- ESCALATION_RULE
- FALLBACK_RULE
- RECOVERY_RULE
- IDEMPOTENCY_RULE

### Confidence/ambiguity/human intervention
- CONFIDENCE_RULE
- AMBIGUITY_RULE
- HUMAN_IN_LOOP_RULE

### Enterprise/client-specific
- CLIENT_BINDING_RULE
- CLIENT_OVERRIDE_RULE
- SYSTEM_OF_RECORD_RULE
- CLIENT_MASTER_DATA_RULE

### Integration and runtime projection
- MAPPING_RULE
- INTEGRATION_RULE
- RUNTIME_CAPABILITY_RULE
- PROJECTION_RULE
- UNSUPPORTED_SEMANTIC_RULE

### Learning/observation
- OBSERVATION_RECONCILIATION_RULE
- KNOWLEDGE_PROMOTION_RULE

### 4.1 Single-valued family, multi-valued cross-reference

`rule_family` is **single-valued per rule instance** — every rule has exactly one primary family, chosen for the obligation it most directly enforces. This is deliberate: a single-valued primary key keeps ownership, versioning and change-propagation (§12) unambiguous.

A rule that is *also* governed by another concern (e.g. a `CLASSIFICATION_RULE` whose applicability is itself set by federal regulation) does not become multi-family. Instead:
- the regulatory/jurisdictional aspect is captured as a **separate, related rule** (e.g. a `REGULATORY_RULE` or `JURISDICTION_RULE` instance) using the existing `related rules / dependencies` field in the rule envelope (§3) to link them;
- or, where the second concern is a *constraint on when the first rule applies* rather than an independent obligation, it is captured as an `applicability condition` on the primary rule (§3), not a second family tag.

This was underspecified in V0.1 and is added as a clarification, not a new mechanism — §3's envelope already has both fields; this section only states which one to use and why a rule is never tagged with two families. Concretely, for the BOL/LTL-03 example worked during independent QA: a hazmat classification rule governed by 49 CFR 172.201 is `rule_family: CLASSIFICATION_RULE` with a `related_rules` link to the governing `REGULATORY_RULE` (the CFR citation), not a rule tagged `CLASSIFICATION_RULE + REGULATORY_RULE`.

## 5. Taxonomy extension rule

The seed taxonomy above MUST NOT become a constraint that distorts new Operational Knowledge.

If a new domain/process reveals a materially different rule concept:
1. preserve the source semantics without forcing it into an inaccurate existing family;
2. create a candidate new family/subtype with definition, scope and differentiation from existing categories;
3. test it against at least the triggering use case and nearby rule families;
4. independently review if it changes canonical schema/behavior;
5. version the taxonomy/contract;
6. map prior rules only where semantically valid;
7. do not rewrite historical frozen rule identities merely to fit the new taxonomy.

The ontology therefore evolves from evidence:
**new Operational Knowledge → candidate semantic pattern → taxonomy review → governed extension**.

## 6. Evaluation mode — how a rule is enforced

Rule family and evaluation mode are independent dimensions.

Seed evaluation modes:
- DETERMINISTIC_EXPRESSION
- DECISION_TABLE
- REFERENCE_LOOKUP
- TABLE_LOOKUP
- MASTER_DATA_LOOKUP
- RETRIEVE_AND_REASON
- LLM_CLASSIFICATION
- LLM_EXTRACTION_WITH_VALIDATION
- EXTERNAL_API
- CLIENT_BINDING
- HUMAN_DECISION
- COMPOSITE

The list is extensible under the same evidence-driven extension rule.

Where deterministic execution is sufficient, do not rely on an LLM merely because the consuming runtime contains AI.

## 7. Distribution mode — how the executor receives the rule

Seed distribution modes:
- EMBED — rule is packaged directly into the version-closed runtime package;
- SNAPSHOT — versioned rule/reference subset is copied into the runtime package and refreshed through controlled release;
- DYNAMIC_LOOKUP — executor calls Atlas (or an Atlas-served rule/knowledge API) at runtime;
- EXTERNAL_AUTHORITY — executor calls the authoritative external service/source rather than Atlas acting as source of truth;
- CLIENT_SYSTEM_LOOKUP — executor obtains current client-specific value from declared system of record;
- HUMAN_RESOLUTION — execution pauses/routes to authorized human resolution.

The list is extensible.

## 8. Atlas availability / runtime dependency principle

Atlas is the **design-time and governance authority for execution semantics**. Atlas MUST NOT become a mandatory always-on dependency for every operational transaction unless a particular rule explicitly requires dynamic Atlas retrieval.

Preferred default is HYBRID consumption:

### Compile/deployment time
Atlas produces a version-closed execution package containing:
- WorkDefinition identity/version;
- applicable rule IDs/rule sets;
- embedded deterministic rules;
- snapshotted rule/reference content;
- client-binding snapshot where permitted;
- runtime projection;
- dependency identities;
- effective-date/version metadata.

### Runtime
The executor runs independently for embedded/snapshotted semantics and performs dynamic calls only for rules classified accordingly.

This prevents:
- Atlas outage from stopping all downstream operations;
- unnecessary latency;
- oversized prompts;
- silent duplication of business logic across runtimes.

## 9. Runtime consumption contract

A runtime projection should specify, for each material rule/rule set:
- rule reference;
- rule version;
- applicability;
- evaluation mode;
- distribution mode;
- required tool/service;
- required client binding;
- failure behavior;
- evidence/audit capture;
- refresh/revalidation policy.

Example conceptual projection:
```
Task: BOL_DIGITIZATION
RuleSet:
  BOL_CORE_V7        -> EMBED / DETERMINISTIC_EXPRESSION
  US_HAZMAT_V4       -> SNAPSHOT / DECISION_TABLE + deterministic validation
  NMFC_REFERENCE_VX  -> DYNAMIC_LOOKUP / REFERENCE_LOOKUP
  CLIENT_REF_RULES   -> CLIENT_SYSTEM_LOOKUP or versioned CLIENT_BINDING
  AMBIGUITY_RULES    -> RETRIEVE_AND_REASON + HUMAN_DECISION threshold
```

## 10. BOL example

For BOL digitization, Atlas may contain dozens of universal/authoritative rules plus client-specific bindings.

The downstream agent should not receive all business knowledge as an unstructured prompt.

Instead:
1. WorkDefinition declares the semantic obligations and applicable rule sets.
2. Runtime projection declares how each rule is evaluated/distributed.
3. The runtime package embeds/snapshots stable critical logic.
4. Dynamic/reference/client lookups are invoked only when declared.
5. Unresolved mandatory rules fail closed or escalate.
6. Every material validation can retain the rule/version/evidence used.

## 11. Multi-runtime projection

The same canonical rule may project differently:
- Agentic AI → tool call, deterministic validator, bounded prompt instruction, retrieval or HITL step;
- RPA → validation component / lookup / exception route;
- BPM/workflow → decision table / gateway / service task;
- Malkom → supported configuration/validation primitive or externalized rule service;
- human operating model → SOP instruction/control/checklist.

Runtime projection MUST NOT change the canonical business meaning.

## 12. Change propagation

When a canonical rule changes:
1. create successor rule/version;
2. classify semantic change;
3. traverse dependency graph;
4. identify affected WorkDefinitions, client bindings, readiness proofs and runtime packages;
5. mark only affected artifacts REVALIDATION_REQUIRED / REGENERATION_REQUIRED;
6. regenerate/redeploy only where necessary.

A source update does not directly mutate live runtime behavior without governed successor/release controls.

## 13. Storage direction

Atlas v2 should support structured rule persistence such as logical entities equivalent to:
- rule;
- rule_version;
- rule_scope;
- rule_source/evidence;
- rule_dependency;
- rule_set;
- WorkDefinition↔rule reference;
- client binding/override;
- runtime projection mapping.

Exact physical schema is governed separately and must reuse/extend the current Atlas backend rather than creating a disconnected rule database.

## 14. Validation / acceptance

Before this contract freezes:
- reconcile against Operational Knowledge Contract v2;
- reconcile against Canonical Work Decomposition V1 and WorkDefinition V1;
- reconcile ATL-60/87/95 semantics;
- prove rule extraction/classification using LTL-03/BOL;
- prove taxonomy can extend using at least one structurally different process/domain example;
- prove EMBED, SNAPSHOT and DYNAMIC_LOOKUP consumption patterns;
- prove one client-binding lookup and one external-authority/reference lookup;
- prove Atlas unavailability does not block a runtime transaction that depends only on embedded/snapshotted rules;
- prove a mandatory dynamic rule fails closed when its required service is unavailable.

## 15. Non-goals

This contract does not:
- require Atlas to execute business transactions;
- require every rule to be evaluated by AI;
- require every executor to call Atlas continuously;
- freeze the seed rule-family list forever;
- promote a new taxonomy category solely because an LLM suggested it;
- make runtime-specific implementation details canonical business truth.
