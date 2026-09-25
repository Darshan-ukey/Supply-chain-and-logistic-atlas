# Atlas P6.1 Successor Generator Architecture v1

Date: 2026-09-20
Status: OWNER-ALIGNED GOVERNING ARCHITECTURE
Workstream: ATL-35 / forward execution-readiness design

## Core decision

P6.1 is not discarded.

Atlas preserves the P6.1 recursive decomposition grammar and uses it inside a stronger successor generator whose inputs are grounded in authoritative domain knowledge.

## Canonical architecture

Authoritative Sources
-> Governed Domain Primitives
-> Deterministic Decomposition Rules
-> Recursive P6.1 Work Decomposition
-> Domain Execution Contract
-> Tool Projection
-> External Executor

Atlas itself does not execute.

## 1. P6.1 grammar

P6.1 survives as the recursive decomposition discipline.

For each unit of work determine:
- trigger / purpose;
- information required;
- decision;
- rule;
- action;
- validation / control;
- evidence;
- before-state / after-state;
- blocker / knowledge gap / client-binding dependency.

Recursion continues until the unit is sufficiently atomic for execution specification or explicitly blocked.

## 2. Authoritative sources

Use applicable regulation, issuer-maintained industry standards, semantic/reference models, carrier/client standards, governed SOP/process evidence, masters and SME validation.

LLM research/extraction may assist but is not itself authoritative evidence.

## 3. Governed domain primitives

Derive and govern reusable domain primitives such as:
- business objects;
- information objects and fields;
- identities/references;
- parties and roles;
- locations;
- lifecycle states/events;
- code sets;
- regulatory conditions;
- object relationships/cardinalities;
- source authority/precedence;
- evidence requirements.

## 4. Deterministic decomposition rules

Define explicit rules for turning governed primitives into process/subprocess/task/activity/work-unit structures.

The generator should not invent decomposition where governed primitives and relationships already determine the work.

## 5. Recursive P6.1 Work Decomposition

Apply the preserved P6.1 grammar recursively to the grounded primitives/rules.

This is the structured reasoning/decomposition layer, not the source of domain truth.

## 6. Domain Execution Contract

For each executor-ready unit, specify the technology-neutral context required for correct execution:
- fields and semantic objects;
- master/reference dependencies;
- contextualization logic;
- identity/relationship validation;
- source precedence;
- decision/business rules;
- regulatory/client conditional rules;
- lifecycle/state logic;
- confidence/ambiguity handling;
- exceptions and queues;
- permissions/authority;
- evidence/audit;
- retry/idempotency/recovery.

## 7. Tool Projection

Translate the same Domain Execution Contract into downstream technology configuration:
- Malkom / IDP;
- RPA;
- AI agent;
- API / integration;
- BPM / workflow.

Only the execution mechanism changes. The governed business logic must remain stable across projections.

## Why this is stronger than the earlier P6.1 generator

Earlier P6.1 primarily supplied a generalized recursive decomposition mechanism.

The successor generator grounds that grammar in source-derived operational semantics and carries the result forward into a formal execution contract and tool-specific projections.

This reduces unsupported synthesis, increases determinism, improves provenance, and supports recovery/re-generation from governed sources rather than conversational memory.

## LTL-03 proof

Use LTL-03 as the worked proof:
- derive source-backed primitives;
- define deterministic decomposition rules;
- apply recursive P6.1 grammar;
- produce Domain Execution Contract;
- project to Malkom/IDP first;
- test whether contextualization improves post-extraction accuracy and touchless processing without requiring a new extractor.

## Recovery rule

Preserve the architecture, source inventory, primitives, decomposition rules, contracts and projections so the generator can be rebuilt after implementation loss without reconstructing historical P6.1 bytes or counts.


## Independent Audit Gate — Claude Crossed QA

The successor generator must not be considered validated solely from ChatGPT research/build evidence.

Before final acceptance, Claude must independently audit:
1. the successor-generator mechanism and rule families;
2. whether authoritative evidence actually supports the governed domain primitives and deterministic generation rules;
3. whether recursive P6.1 decomposition is applied consistently and without unsupported synthesis;
4. whether the resulting Domain Execution Contract is technology-neutral and sufficiently complete;
5. whether tool projections preserve the governed business logic;
6. whether the generator reproduces the independently derived BOL information/field universe with correct provenance, cardinality, lifecycle, validation, relationship, exception and queue logic;
7. false positives, unsupported fields/rules, missing authoritative fields, and client-specific assumptions incorrectly promoted to canonical truth.

### Audit evidence package
The audit package must include at minimum:
- governing architecture and methodology;
- authoritative source inventory and versions;
- field/provenance matrix;
- deterministic generator rules;
- generated LTL-03 Work Decomposition;
- generated Domain Execution Contract;
- independently derived BOL field universe;
- generator output crosswalk against that universe;
- unresolved gaps/client-binding dependencies;
- test results and any false-correction / unsafe-inference evidence.

### Crossed-QA rule
ChatGPT may research/build the successor generator, but may not independently close its own final validation gate. Claude performs the independent audit; Owner/Governor retains acceptance authority.
