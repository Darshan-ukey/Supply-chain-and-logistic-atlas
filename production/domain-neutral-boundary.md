# Stage 18.5 — Domain-Neutral Core Boundary

## Decision

The platform is now split into a domain-neutral **Enterprise Operations Core** and registrable **Domain Packs**.

The refactor does not generalize or dilute the existing Supply Chain Atlas content. Road LTL V1.2 and Page 0 remain canonical Supply Chain assets. A compatibility adapter maps the legacy Supply Chain child-module contract into the enterprise core at runtime.

## Enterprise Operations Core

The frozen core ontology contains only:

- Process
- Task
- State
- Event
- Decision
- Rule
- Control
- Actor
- System
- Business Object
- Evidence
- Outcome
- Relationship
- Provenance
- Applicability

The core engine knows how to:

- validate a normalized module;
- render a domain pack's territory model;
- perform semantic zoom;
- compose execution sequence from relationships;
- extract domain-defined signals;
- build an inspector contract;
- trace business objects;
- evaluate domain-defined applicability dimensions;
- execute domain-defined transformation heuristics.

It does **not** contain Shipment, Carrier, Road LTL, BOL/AWB/POD, Movement Pattern, Carriage Regime, Physical signal, Supply Chain territories, or Supply Chain transformation rules.

## Domain Extension Contract

Each Domain Pack registers:

1. ontology extensions;
2. territories and semantic placement;
3. applicability dimensions;
4. signal types and field extractors;
5. transformation heuristics;
6. domain vocabulary;
7. optional compatibility/extension metadata.

Domain packs may extend the core; they may not redefine core concept meaning.

## Supply Chain Domain Pack

The Supply Chain pack now owns the SCM-specific semantics that previously looked universal:

- Shipment / Consignment / Handling Unit;
- Transport Document / BOL / AWB / POD;
- Carrier;
- Mode / Service / Movement Pattern / Node;
- Custody;
- Carriage Regime;
- Dangerous Goods / jurisdiction applicability;
- the 15 Page-0 territories;
- Physical, Information, Data/Document, Financial, Control/Evidence signals;
- the current eight transformation heuristic families.

The 70-page Supply Chain content itself is unchanged.

## Legacy boundary

Two adapters deliberately sit **outside** the core:

- `supply-chain-legacy-v1.js` maps the existing `atlas-data-contract-v1.0` SCM module into the enterprise module contract.
- `legacy-canvas-compat.js` temporarily aliases generic `territoryId` back to `page0DomainId` for the existing renderer while the renderer is incrementally modernized.

The compatibility aliases are not part of the Enterprise Operations ontology.

## Accounts Payable architectural fixture

The AP fixture is intentionally tiny and synthetic:

`Invoice Receipt → Validate → Match → Exception → Approval → Post → Payment`

It is not a Finance Atlas, not an AP taxonomy, and not a claim of best practice.

It exists only to answer the architectural question:

> Can a non-SCM domain use the same module registry, rules, canvas model, semantic zoom, playback, inspector, trace and transformation engines without changing those engines?

The Stage 18.5 acceptance suite answers **yes**.

## Publication guardrail

The AP fixture is registered as `TEST_ONLY`, `approved=false`, and `mustNotPublish=true`. It must never appear as production domain knowledge.
