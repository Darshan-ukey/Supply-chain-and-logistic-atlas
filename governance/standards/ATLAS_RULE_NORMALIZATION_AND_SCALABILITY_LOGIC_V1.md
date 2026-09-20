# Atlas Rule-Normalization and Scalability Logic v1

Date: 2026-09-20
Status: OWNER-ALIGNED GOVERNING METHODOLOGY
Applies to: ATL-35 and all subsequent execution-readiness research/generation

## Core principle

Atlas must not become a repository of millions of independently authored rules, validations, schemas and task-specific logic.

The governing target is:

Authoritative Evidence
-> Domain Fact
-> Semantic Primitive
-> Reusable Rule Family
-> Generated Rule Instance
-> Client Binding
-> Runtime / Tool Projection

## Rule-normalization test

For every newly discovered rule, validation, schema constraint, decision, exception or contextualization requirement ask:

**Is this genuinely a new execution rule, or another instance of an existing semantic primitive or reusable rule family?**

Do not create a new rule family merely because field, document, task, carrier, client or use case differs.

Examples:
- shipment weight, commodity weight, pallet weight, dimensions and other measures should first be tested against a reusable Measure(value, unit, semanticOwner, source, confidence) primitive/family.
- PRO, BOL number, booking reference, PO number and shipment ID should first be tested against reusable Identifier / Reference primitives and rule families.

## Required classification

### 1. Execution Grammar
Highly reusable operations:
identify, resolve, validate, compare, decide, mutate, verify, reconcile, enrich, correct, route, escalate.

### 2. Semantic Primitives
Reusable structures including:
Identifier, Reference, Measure, Party, Location, Document, Handling Unit, Commodity, State, Event, Relationship, Controlled Vocabulary, Master Reference.

### 3. Domain Rule Families
Evidence-supported logistics/LTL specializations of the primitives.

### 4. Generated Rule Instances
Concrete execution rules instantiated for a particular field/object/task from primitives and rule families.

### 5. Client Binding
Client/carrier/system-specific values, thresholds, masters, overrides, routing and authority.

### 6. Runtime Projection
Translation of the resulting contract into Malkom/IDP, RPA, AI agent, API, BPM/workflow or another executor.

## Reuse requirement

Before accepting any new rule family:
1. search the existing rule-family catalogue;
2. test whether an existing semantic primitive can represent the requirement;
3. test whether an existing rule family can be parameterized or composed;
4. create a new primitive/rule family only when the semantics are materially different;
5. preserve authoritative evidence for the specialization.

Do not force unlike semantics into one family merely to reduce rule count. Normalization must preserve operational meaning.

## Cross-family evidence relationship governance

Normalization must preserve relationships among evidence, primitives, rule families, generated instances and client bindings.

A single authoritative fact may legitimately:
- instantiate more than one semantic primitive;
- activate or parameterize more than one reusable rule family;
- constrain the order in which families execute;
- establish a dependency between generated rule instances;
- act as source authority for one semantic attribute while serving as corroborating context for another.

Do not duplicate the same evidence into unrelated standalone rules merely because multiple families consume it.

### Evidence relationship graph

For each material evidence item, preserve a graph with at least:

Evidence
-> Domain Fact(s)
-> Semantic Primitive(s)
-> Reusable Rule Family/Families
-> Generated Rule Instance(s)
-> Cross-instance dependency/ordering
-> Client Binding(s), where applicable
-> Runtime Projection(s), where applicable

### Required relationship types

Capture, where applicable:
- DERIVES_FROM — primitive/rule instance derives from evidence/domain fact;
- SPECIALIZES — domain/client evidence specializes a broader family;
- COMPOSES_WITH — two or more families jointly generate one execution behavior;
- DEPENDS_ON — one generated instance requires another result;
- ACTIVATES — a condition activates another requirement/rule instance;
- CONSTRAINS — evidence/rule restricts valid values, relationships, sequence or cardinality;
- RESOLVES_WITH — semantic resolution requires a master/reference/related object;
- OVERRIDES_WITHIN_SCOPE — client binding legitimately strengthens/overrides canonical optional behavior within defined scope;
- PRECEDES — execution order is semantically required;
- CORROBORATES — evidence supports but does not independently establish canonical truth;
- CONFLICTS_WITH — evidence sources disagree and require source-authority handling.

### Cross-family composition rule

When an execution behavior requires multiple families, preserve the composition explicitly rather than manufacturing a synthetic all-in-one family.

Example:
Hazmat package quantity:
RF7 Conditional Activation
ACTIVATES
RF4 Requiredness/Cardinality
COMPOSES_WITH
RF5 Controlled-Value Validation.

Example:
PRO update:
RF1 Identity/Reference Resolution
PRECEDES / DEPENDS_ON
RF3 Lifecycle & State Transition.

Example:
Consignee canonicalization:
RF2 Relationship Integrity
PRECEDES
RF6 Master/Reference Reconciliation;
RF9 Source Authority may CONSTRAIN the selected canonical value.

Example:
Package gross weight:
RF2 Relationship Integrity identifies semantic owner;
RF14 Hierarchy constrains package position;
RF13 Measure Semantics validates value/unit.

### Evidence deduplication

Evidence is stored/referenced once with stable provenance and may have multiple governed edges.

Do not clone the evidence record separately into each family. This prevents provenance drift and contradictory interpretations of the same source.

### Conflict handling across families

If two families derive incompatible generated outcomes from the same or different evidence:
1. preserve both derivations;
2. apply source-authority/lifecycle rules;
3. identify whether the conflict is semantic, temporal, client-specific or evidentiary;
4. resolve only when governed evidence supports resolution;
5. otherwise emit a conflict/knowledge-gap state rather than forcing consistency.

### Audit requirement

ATL-37 evidence must allow Claude to trace in both directions:
- Evidence -> all primitives/families/instances it supports;
- Generated rule instance -> all evidence, primitives and family compositions used to create it.

## Scalability measurement

Track by task:
- apparent execution rules discovered;
- unique semantic primitives used;
- unique reusable rule families used;
- new rule families introduced;
- existing rule families reused;
- generated rule instances;
- client-specific bindings;
- rules requiring genuine bespoke treatment.

### Rule Reuse Ratio

generated rule instances using existing families / total generated rule instances

### New Rule Family Rate

new reusable rule families introduced / task

Expected mature pattern:
new tasks increasingly reuse existing grammar, primitives and families while generated instances rise faster than the canonical family count.

## Architectural failure signal

If each new task still requires hundreds of fundamentally new handcrafted rules after normalization, treat this as an architecture/scalability finding.

Investigate whether:
- primitives are too narrow;
- rule families are defined at the wrong abstraction level;
- domain knowledge is being confused with client configuration;
- task-specific instances are being mistaken for canonical rules;
- runtime/tool-specific requirements are leaking into the Domain Execution Contract.

## Relationship to P6.1

P6.1 remains the recursive work-decomposition grammar.

Authoritative evidence supplies domain truth.
Normalized primitives and reusable rule families supply deterministic generation logic.

Target architecture:

Authoritative Sources
-> Governed Domain Facts
-> Semantic Primitives + Reusable Rule Families
-> Deterministic Rule Generation
-> Recursive P6.1 Work Decomposition
-> Domain Execution Contract
-> Client Binding
-> Tool Projection
-> External Executor

Atlas remains an execution-readiness/specification layer, not the execution engine.

## Dual-track research model

### Track A — Authoritative knowledge discovery
Discover source-backed execution facts, constraints, lifecycles, relationships, code sets, evidence and exceptions.

### Track B — Continuous normalization
Continuously map discoveries into reusable primitives, families, generated instances and client bindings.

Both tracks run concurrently.

## LTL-03 purpose

LTL-03 must prove both:
1. one task can become execution-ready from authoritative evidence; and
2. Atlas can discover a small reusable execution grammar that generates a much larger rule-instance universe.

## Freeze boundary

Atlas freezes the **mechanism**, not the rule-family catalogue.

### Frozen mechanism
The following are governing invariants unless explicitly changed by Owner governance:
- every discovery begins from authoritative evidence / governed domain fact;
- every discovery is mapped first to semantic primitives;
- the existing rule-family catalogue must be searched before adding a new family;
- existing families should be parameterized or composed where semantics genuinely fit;
- a new family is created only when existing primitives/families are materially insufficient;
- every specialization preserves authoritative provenance;
- client/carrier/system variation is classified as Client Binding unless it changes canonical domain semantics;
- runtime/tool-specific implementation remains in Tool Projection and must not leak into the Domain Execution Contract;
- generated rule instances remain distinguishable from canonical reusable families;
- unlike semantics must not be forcibly merged merely to reduce rule count;
- scalability metrics and architectural-failure signals are continuously tracked.

### Evolvable catalogue
The set of:
- semantic primitives;
- reusable rule families;
- parameters;
- domain specializations;
- generated instances;

is expected to evolve as new authoritative evidence is discovered.

Therefore RF1-RF16 are a **current candidate catalogue**, not a frozen ontology.

A future evidence-backed RF17, RF18, or a revised primitive is valid when:
1. the existing catalogue has been searched;
2. composition/parameterization has been tested;
3. the semantic distinction is material;
4. evidence supports the distinction;
5. the change is classified correctly as canonical domain logic rather than client binding or runtime projection.

### Stability objective
Atlas seeks convergence toward a reusable grammar, not a permanently fixed finite number of rules.

Success means:
- new evidence increasingly maps to existing primitives/families;
- genuinely new semantics can still extend the catalogue;
- generated instances grow much faster than canonical-family count;
- catalogue growth remains evidence-driven and reviewable.

## Governance rule

A research artifact may introduce a candidate new rule family only if it includes:
- why existing primitives/families are insufficient;
- what materially different semantics justify the new family;
- authoritative evidence for the specialization;
- whether the family is domain-generic, LTL-specific, client-specific or runtime-specific.

Client-specific and runtime-specific logic must not be promoted into the canonical domain rule-family catalogue.
