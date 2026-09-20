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

## Governance rule

A research artifact may introduce a candidate new rule family only if it includes:
- why existing primitives/families are insufficient;
- what materially different semantics justify the new family;
- authoritative evidence for the specialization;
- whether the family is domain-generic, LTL-specific, client-specific or runtime-specific.

Client-specific and runtime-specific logic must not be promoted into the canonical domain rule-family catalogue.
