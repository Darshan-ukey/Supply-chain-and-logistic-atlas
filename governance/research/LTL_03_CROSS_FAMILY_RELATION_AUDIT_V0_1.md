# LTL-03 Cross-Family Relationship Audit v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: GOVERNANCE IMPLEMENTATION AUDIT — CORRECTIONS REQUIRED

## Audit question

Does the current LTL-03 research corpus correctly capture relationships among evidence, semantic primitives, reusable rule families and generated rule instances within and across families?

## Overall finding

**PARTIALLY.**

The governing mechanism is sound, but several current artifacts record only family composition (for example RF1+RF3) rather than the complete typed evidence relationship graph.

This is an implementation gap, not a conceptual failure.

## What currently works

### 1. Cross-family composition is being recognized
Examples already present:
- PRO update = RF1 Identity/Reference + RF3 Lifecycle.
- Consignee resolution = RF2 Relationship + RF6 Master Reconciliation.
- Hazmat package number/type = RF7 Conditional Activation + RF4 Requiredness/Cardinality + RF5 Controlled Value.
- Package gross weight = RF13 Measure + relationship/hierarchy logic.
- LocationID = RF1 Identity + RF6 Master Reconciliation + RF11 Client Specialization.

### 2. Semantic sequencing is partly captured
The Domain Execution Contract already requires:
Structural correctness -> Semantic correctness -> Value correctness.

Examples:
- role before identity;
- semantic owner before value correction;
- identity resolution before update/delete;
- conditional activation before hazmat field validation.

### 3. Evidence classes and source authority exist
Research distinguishes A/B/C evidence and already recognizes field-level source authority, master lookup and client binding.

## Gaps found

### GAP-1 — No stable evidence identifiers

Current artifacts name sources such as:
- 49 CFR 373.101;
- 49 CFR 172.202;
- NMFTA eBOL 2.1.0;
- UN/CEFACT D23B;

but do not consistently assign stable evidence IDs.

Without stable IDs, multiple families can silently cite the same source differently and provenance can drift.

### Correction

Introduce stable evidence references, e.g.:
- EV-49CFR-373-101
- EV-49CFR-172-202
- EV-49CFR-172-203
- EV-NMFTA-EBOL-2.1-LIFECYCLE
- EV-NMFTA-EBOL-2.1-LOCATIONID
- EV-UNECE-D23B-CONSIGNMENT-ID
- EV-UNECE-D23B-MEASURE
- EV-UNECE-D23B-PACKAGE
- EV-UNECE-D23B-ASSOCIATED-DOCUMENT

Exact ID naming may evolve, but every canonical evidence item needs one stable key.

### GAP-2 — Family lists are not typed relationships

The generated instance catalogue currently records compositions like:
RF1+RF3
RF5+RF7
RF4+RF5+RF7

This identifies participating families but not how they relate.

Example:
"Resolve BOL update target by PRO | RF1+RF3"

Missing:
- RF1 PRECEDES RF3;
- RF3 DEPENDS_ON successful RF1 resolution;
- NMFTA lifecycle evidence DERIVES RF3 behavior;
- NMFTA PRO evidence DERIVES RF1 instance;
- failed RF1 resolution ACTIVATES identity-not-found exception rather than update transition.

### Correction

Every multi-family generated instance must declare typed edges.

### GAP-3 — Evidence-to-family fan-out is not explicitly enumerated

A single evidence item can support multiple facts/families.

Example 49 CFR 172.202:
- activates hazmat requirements (RF7);
- supplies controlled values/semantics (RF5);
- requires quantity/unit (RF13);
- requires package number/type (RF4/RF5);
- constrains sequence (RF10).

The artifacts currently repeat these facts in multiple places but do not preserve a single evidence node with governed outgoing edges.

### Correction

Store evidence once; link it to every derived fact/primitive/family/instance.

### GAP-4 — Cross-field dependencies are incompletely represented

Examples:
- package count depends on existence/interpretation of package children for reconciliation;
- package gross weight depends on semantic package ownership;
- consignee master match depends on role classification;
- BOL update depends on PRO-to-document identity resolution;
- hazmat sequence depends on the hazmat description group having been activated and resolved.

These dependencies are described in prose but not represented as first-class graph edges.

### GAP-5 — Conflict relationships are not systematically materialized

The Domain Execution Contract recognizes source precedence, but current matrices do not consistently represent:
CONFLICTS_WITH / SUPERSEDES / COEXISTS_AS_DISTINCT_SEMANTIC.

Example:
declared weight and verified weight should often coexist as distinct semantic values, not conflict/overwrite.

The graph must distinguish:
- genuine contradiction;
- different lifecycle versions;
- different semantic attributes;
- client override;
- lower-authority corroboration.

### GAP-6 — RF17 and new primitives are not yet reconciled into the central contract/catalogue

The current Domain Execution Contract v0.2 still maps historical G1-G26 and predates:
- RF17 Monetary Amount / Charge Semantics;
- Indicator primitive;
- TemporalValue primitive;
- cross-family relationship governance.

This creates a version-consistency gap.

## Required graph record

Each generated execution rule instance should minimally preserve:

- instanceId
- taskId
- semanticOwner
- field/object
- lifecycleStage
- evidenceIds[]
- domainFactIds[]
- primitiveIds[]
- familyIds[]
- edges[]
- clientBindingIds[]
- sourceAuthority
- disposition/exception behavior
- unresolvedEvidenceGaps[]

Each edge:
- from
- relationType
- to
- evidenceId(s)
- condition/scope
- sequence/precondition if applicable

## Worked relationship graphs

### A. PRO update

EV-NMFTA-PRO
DERIVES_FROM -> FACT-PRO-IS-UPDATE-IDENTIFIER

FACT-PRO-IS-UPDATE-IDENTIFIER
INSTANTIATES -> Identifier/Reference primitive

Identifier primitive
SPECIALIZES -> RF1 Identity & Reference Resolution

RF1 instance: Resolve PRO to BOL
PRECEDES -> RF3 instance: Update BOL

RF3 Update BOL
DEPENDS_ON -> successful PRO resolution

PRO not found
ACTIVATES -> BOL_IDENTITY_NOT_FOUND

Client-specific PRO format/check rule
SPECIALIZES -> RF11 Client Binding
CONSTRAINS -> RF1 instance

### B. Consignee canonicalization

EV-49CFR-373-101
DERIVES -> FACT-CONSIGNEE-PRESENCE

EV-UNECE-CONSIGNEE-ROLE
DERIVES -> FACT-CONSIGNEE-ROLE

FACT-CONSIGNEE-ROLE
INSTANTIATES -> Party + Relationship primitives
SPECIALIZES -> RF2

RF2 role resolution
PRECEDES -> RF6 master reconciliation

Client consignee master
RESOLVES_WITH -> RF6 instance

RF9 source authority
CONSTRAINS -> whether master value may replace/enrich document value

Two surviving candidates
ACTIVATES -> PARTY_IDENTITY_AMBIGUOUS

### C. Hazmat package quantity/type

EV-49CFR-172-202
ACTIVATES -> RF7 hazmat condition

RF7 active
ACTIVATES -> RF4 package-count requiredness
COMPOSES_WITH -> RF5 package-type validation

Package quantity Measure/Collection semantics
CONSTRAINS -> valid package relation

RF10
CONSTRAINS -> placement/order within basic description when applicable

### D. Package gross weight

EV-UNECE-PACKAGE
DERIVES -> Package primitive

EV-UNECE-MEASURE
DERIVES -> Measure(value, unit)

RF2
RESOLVES -> semantic owner = package

RF14
CONSTRAINS -> package hierarchy/context

RF13
DEPENDS_ON -> resolved package owner
VALIDATES -> weight value/unit

RF12 may
COMPOSES_WITH -> aggregate reconciliation when parent/child totals are governed.

### E. Monetary charge

EV-UNECE-SERVICE-CHARGE
DERIVES -> MonetaryAmount primitive
SPECIALIZES -> RF17

EV-UNECE-PAYING-PARTY-ROLE
DERIVES -> Party/Relationship + Controlled Vocabulary
COMPOSES_WITH -> RF2 + RF5

RF17 charge validation
DEPENDS_ON -> amount purpose/currency
MAY_RESOLVE_WITH -> payer role
MAY_BE_CONSTRAINED_BY -> RF9 source authority
MAY_BE_SPECIALIZED_BY -> RF11 client binding

This demonstrates that RF17 is not isolated; it composes with existing families.

## Audit conclusion

The new governance mechanism correctly identifies the *types* of relationships Atlas needs.

However, current research artifacts do not yet implement those relationships consistently enough for machine-verifiable generation or ATL-37 audit.

### Required correction before further large-scale research

1. establish stable Evidence IDs and Domain Fact IDs;
2. upgrade generated-instance catalogue from family lists to typed graph relationships;
3. reconcile Domain Execution Contract with normalized RF catalogue and new primitives;
4. distinguish dependency, activation, constraint, precedence and conflict edges;
5. require bidirectional provenance for every generated instance.

After these corrections, authoritative research can continue safely without accumulating ambiguous cross-family relationships.
